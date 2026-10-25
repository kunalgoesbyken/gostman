package sandbox

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"time"

	"github.com/dlclark/regexp2"
	"github.com/dop251/goja"
)

//go:embed bundle.js
var bundle string

const (
	bundleName    = "bundle.js"
	exportsName   = "gostman"
	messageField  = "message"
	encodedAbsent = "null"

	patternAllowance = time.Second
)

var (
	errExpired = errors.New("the script ran out of time")
	errMemory  = errors.New("the script used too much memory")
	errStalled = errors.New("The script is waiting for something that never happens.")
)

var promiseType = reflect.TypeOf((*goja.Promise)(nil))

func init() {
	regexp2.DefaultMatchTimeout = patternAllowance
}

var compiled = sync.OnceValues(func() (*goja.Program, error) {
	return goja.Compile(bundleName, bundle, true)
})

type machine struct {
	vm        *goja.Runtime
	exports   *goja.Object
	timers    *timers
	parse     goja.Callable
	stringify goja.Callable
}

func boot() (*machine, error) {
	program, err := compiled()
	if err != nil {
		return nil, fmt.Errorf("the script runtime does not compile: %w", err)
	}
	vm := goja.New()
	pending := &timers{}
	pending.install(vm)
	if err := installGlobals(vm); err != nil {
		return nil, fmt.Errorf("the script runtime does not start: %w", err)
	}
	if _, err := vm.RunProgram(program); err != nil {
		return nil, fmt.Errorf("the script runtime does not start: %w", err)
	}
	exports := vm.Get(exportsName).ToObject(vm)
	if err := vm.Set(exportsName, goja.Undefined()); err != nil {
		return nil, fmt.Errorf("the script runtime does not start: %w", err)
	}
	codec := vm.Get("JSON").ToObject(vm)
	parse, _ := goja.AssertFunction(codec.Get("parse"))
	stringify, _ := goja.AssertFunction(codec.Get("stringify"))
	return &machine{
		vm:        vm,
		exports:   exports,
		timers:    pending,
		parse:     parse,
		stringify: stringify,
	}, nil
}

func (m *machine) invoke(function string, limit time.Duration, arguments []any) (string, error) {
	callee, ok := goja.AssertFunction(m.exports.Get(function))
	if !ok {
		return "", fmt.Errorf("the script runtime has no %s function", function)
	}
	values, err := m.decodeAll(arguments)
	if err != nil {
		return "", err
	}

	deadline := time.Now().Add(limit)
	guard := watch(m.vm, limit)
	defer guard.release()

	returned, err := callee(goja.Undefined(), values...)
	if err != nil {
		return "", m.failure(err)
	}
	settled, err := m.settle(returned, deadline)
	if err != nil {
		return "", err
	}
	return m.encode(settled)
}

func (m *machine) decodeAll(arguments []any) ([]goja.Value, error) {
	values := make([]goja.Value, 0, len(arguments))
	for _, argument := range arguments {
		encoded, err := json.Marshal(argument)
		if err != nil {
			return nil, err
		}
		value, err := m.parse(goja.Undefined(), m.vm.ToValue(string(encoded)))
		if err != nil {
			return nil, m.failure(err)
		}
		values = append(values, value)
	}
	return values, nil
}

func (m *machine) encode(value goja.Value) (string, error) {
	encoded, err := m.stringify(goja.Undefined(), value)
	if err != nil {
		return "", m.failure(err)
	}
	if goja.IsUndefined(encoded) {
		return encodedAbsent, nil
	}
	return encoded.String(), nil
}

func asPromise(value goja.Value) (*goja.Promise, bool) {
	object, ok := value.(*goja.Object)
	if !ok || object.ExportType() != promiseType {
		return nil, false
	}
	promise, ok := object.Export().(*goja.Promise)
	return promise, ok
}

func (m *machine) settle(value goja.Value, deadline time.Time) (goja.Value, error) {
	promise, ok := asPromise(value)
	if !ok {
		return value, nil
	}
	for promise.State() == goja.PromiseStatePending {
		if err := m.timers.runNext(deadline); err != nil {
			return nil, m.failure(err)
		}
	}
	if promise.State() == goja.PromiseStateRejected {
		return nil, errors.New(m.describe(promise.Result()))
	}
	return promise.Result(), nil
}

func (m *machine) failure(err error) error {
	var interrupted *goja.InterruptedError
	if errors.As(err, &interrupted) {
		if reason, ok := interrupted.Value().(error); ok {
			return reason
		}
		return errExpired
	}
	var thrown *goja.Exception
	if errors.As(err, &thrown) {
		return errors.New(m.describe(thrown.Value()))
	}
	return err
}

func (m *machine) describe(thrown goja.Value) string {
	if object, ok := thrown.(*goja.Object); ok {
		if message := object.Get(messageField); message != nil && !goja.IsUndefined(message) {
			return message.String()
		}
	}
	return thrown.String()
}
