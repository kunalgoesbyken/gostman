package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"reflect"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mcp"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type Settings struct {
	Root         string
	Environment  string
	Variables    map[string]string
	Secrets      map[string]bool
	Policy       engine.Policy
	AllowedHosts []string
	Timeout      time.Duration
	Insecure     bool
	ExposeTags   []string
	SignIn       engine.Token
}

type Desk struct {
	mu        sync.Mutex
	busy      sync.Mutex
	files     *workspace.Workspace
	client    *Client
	startup   map[string]string
	timeout   time.Duration
	insecure  bool
	mocking   mocking
	reach     *destinations
	responses responseLog
	exposed   []exposure
	seen      *snapshot
	earlier   runner.Collection
}

type scene struct {
	files  workspace.Collection
	stored runner.Collection
}

type reading struct {
	files   workspace.Collection
	authors authorship
	dotEnv  map[string]string
	modules map[string]string
}

type snapshot struct {
	read    reading
	current scene
}

type attached interface {
	Attachment() string
	Embed(text string) any
}

type access int

const (
	filesOnly access = iota
	withSession
)

func Open(settings Settings) (*Desk, error) {
	state, err := workspace.Inspect(settings.Root)
	if err != nil {
		return nil, err
	}
	if state != workspace.Existing {
		return nil, fmt.Errorf("%s is not a Gostman workspace; create one with \"gostman init\"", settings.Root)
	}
	files, err := workspace.Open(settings.Root)
	if err != nil {
		return nil, err
	}
	reach := newDestinations(settings.AllowedHosts)
	policy := settings.Policy
	policy.Permit = reach.permit
	client, err := NewClient(policy)
	if err != nil {
		return nil, err
	}
	if err := client.separateCatalog(); err != nil {
		return nil, err
	}
	client.MarkSecret(settings.Secrets)
	client.session.Confine(secretScope{client: client, reach: reach})
	desk := &Desk{
		files:    files,
		client:   client,
		startup:  settings.Variables,
		timeout:  settings.Timeout,
		insecure: settings.Insecure,
		reach:    reach,
	}
	current, err := desk.refresh()
	if err != nil {
		return nil, err
	}
	if err := client.Enter(current.stored, settings.Environment, settings.Variables); err != nil {
		return nil, err
	}
	client.SignIn(settings.SignIn)
	desk.exposed, err = desk.expose(current, settings.ExposeTags)
	return desk, err
}

func (d *Desk) authors() (authorship, error) {
	requests, err := d.files.AgentAuthored()
	if err != nil {
		return authorship{}, err
	}
	variables, err := d.files.AgentVariables()
	return authorship{requests: requests, variables: variables}, err
}

func (d *Desk) study(files workspace.Collection, authors authorship, err error) {
	if err != nil {
		d.reach.forget()
		return
	}
	d.reach.learn(files, authors, d.startup)
}

func (d *Desk) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.mocking.stop()
}

func (d *Desk) refresh() (scene, error) {
	if err := d.files.Reload(); err != nil {
		return scene{}, err
	}
	files := d.files.Collection()
	authors, err := d.authors()
	extras := runner.WithFolderFiles(runner.Collection{}, d.files)
	read := reading{files: files, authors: authors, dotEnv: extras.DotEnv, modules: extras.Modules}
	if err == nil && d.seen != nil && reflect.DeepEqual(d.seen.read, read) {
		return d.seen.current, nil
	}
	d.seen = nil
	d.study(files, authors, err)
	stored, err := runner.FromWorkspace(files)
	if err != nil {
		return scene{}, err
	}
	stored.DotEnv, stored.Modules = extras.DotEnv, extras.Modules
	if stored, err = d.client.catalog.Normalized(stored, d.earlier); err != nil {
		return scene{}, err
	}
	d.earlier = stored
	current := scene{files: files, stored: stored}
	if err := d.client.Study(stored); err != nil {
		return current, err
	}
	d.seen = &snapshot{read: read, current: current}
	return current, nil
}

func (d *Desk) outside(work func()) {
	d.mu.Unlock()
	defer d.mu.Lock()
	work()
}

func (d *Desk) tune(request runner.Request) runner.Request {
	if request.Options.TimeoutMs == 0 {
		request.Options.TimeoutMs = int(d.timeout.Milliseconds())
	}
	if d.insecure {
		request.Options.InsecureTLS = true
	}
	return request
}

func decodeStrict(raw json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func answer[A, R any](d *Desk, ctx context.Context, kind access, arguments A, handle func(*Desk, context.Context, scene, A) (R, error)) (mcp.Result, error) {
	current, err := d.refresh()
	if err != nil {
		return mcp.Result{}, err
	}
	if kind == withSession {
		if err := d.client.session.LoadCollectionVariables(current.stored); err != nil {
			return mcp.Result{}, err
		}
	}
	value, err := handle(d, ctx, current, arguments)
	if err != nil {
		return mcp.Result{}, err
	}
	cleaned, err := redact.Clean(d.client.guard, value)
	if err != nil {
		return mcp.Result{}, err
	}
	result := mcp.Result{Value: cleaned}
	if carrier, ok := any(value).(attached); ok {
		result.Text = d.client.Text(carrier.Attachment())
		result.Structured = any(cleaned).(attached).Embed(result.Text)
	}
	return result, nil
}

func (d *Desk) lock(kind access) func() {
	if kind == withSession {
		d.busy.Lock()
	}
	d.mu.Lock()
	return func() {
		d.mu.Unlock()
		if kind == withSession {
			d.busy.Unlock()
		}
	}
}

func parameterNames(input any) []string {
	shape, _ := input.(schema)
	properties, _ := shape["properties"].(map[string]schema)
	return slices.Sorted(maps.Keys(properties))
}

func takes(parameters []string) string {
	if len(parameters) == 0 {
		return "it takes no arguments"
	}
	return "it takes " + strings.Join(parameters, ", ")
}

func unknownArgument(raw json.RawMessage, parameters []string) error {
	var given map[string]json.RawMessage
	if json.Unmarshal(raw, &given) != nil {
		return nil
	}
	for _, name := range slices.Sorted(maps.Keys(given)) {
		if !slices.Contains(parameters, name) {
			return fmt.Errorf("%q is not a parameter of this tool; %s.", name, takes(parameters))
		}
	}
	return nil
}

func expectedKind(kind reflect.Type) string {
	switch kind.Kind() {
	case reflect.String:
		return "a string"
	case reflect.Bool:
		return "true or false"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "a whole number"
	case reflect.Float32, reflect.Float64:
		return "a number"
	case reflect.Slice, reflect.Array:
		return "a list"
	default:
		return "an object"
	}
}

func argumentProblem(err error) error {
	var mistyped *json.UnmarshalTypeError
	if errors.As(err, &mistyped) && mistyped.Field != "" {
		return fmt.Errorf("%s must be %s; see this tool's input schema.", mistyped.Field, expectedKind(mistyped.Type))
	}
	return fmt.Errorf("The arguments must be a JSON object that matches this tool's input schema: %s", err)
}

func decodeArguments(raw json.RawMessage, parameters []string, target any) error {
	if err := unknownArgument(raw, parameters); err != nil {
		return err
	}
	if err := decodeStrict(raw, target); err != nil {
		return argumentProblem(err)
	}
	return nil
}

func bind[A, R any](d *Desk, kind access, parameters []string, handle func(*Desk, context.Context, scene, A) (R, error)) func(context.Context, json.RawMessage) (mcp.Result, error) {
	return func(ctx context.Context, raw json.RawMessage) (mcp.Result, error) {
		var arguments A
		if err := decodeArguments(raw, parameters, &arguments); err != nil {
			return mcp.Result{}, err
		}
		defer d.lock(kind)()
		result, err := answer(d, ctx, kind, arguments, handle)
		if err != nil {
			return mcp.Result{}, errors.New(d.client.Text(err.Error()))
		}
		return result, nil
	}
}

func tool[A, R any](d *Desk, spec mcp.Tool, kind access, handle func(*Desk, context.Context, scene, A) (R, error)) mcp.Tool {
	spec.OutputSchema = outputOf[R]()
	spec.Handle = bind(d, kind, parameterNames(spec.InputSchema), handle)
	return spec
}
