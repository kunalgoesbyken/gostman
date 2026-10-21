package sandbox

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"unicode"

	"github.com/dop251/goja"
)

const (
	uuidVersion4  = 0x40
	uuidVariantRF = 0x80
)

func latin1(vm *goja.Runtime, text string) []byte {
	encoded := make([]byte, 0, len(text))
	for _, character := range text {
		if character > unicode.MaxLatin1 {
			panic(vm.NewTypeError("btoa: the string contains characters outside the Latin-1 range"))
		}
		encoded = append(encoded, byte(character))
	}
	return encoded
}

func fromLatin1(decoded []byte) string {
	characters := make([]rune, len(decoded))
	for i, value := range decoded {
		characters[i] = rune(value)
	}
	return string(characters)
}

func randomUUID(vm *goja.Runtime) string {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		panic(vm.NewGoError(err))
	}
	value[6] = value[6]&0x0f | uuidVersion4
	value[8] = value[8]&0x3f | uuidVariantRF
	return fmt.Sprintf("%x-%x-%x-%x-%x", value[0:4], value[4:6], value[6:8], value[8:10], value[10:16])
}

type Bridge func(request string) (string, error)

const hostSendName = "hostSend"

func installGlobals(vm *goja.Runtime, bridge Bridge) error {
	encode := func(text string) string {
		return base64.StdEncoding.EncodeToString(latin1(vm, text))
	}
	decode := func(text string) string {
		decoded, err := base64.StdEncoding.DecodeString(text)
		if err != nil {
			panic(vm.NewTypeError("atob: the string is not valid base64"))
		}
		return fromLatin1(decoded)
	}
	crypto := vm.NewObject()
	if err := crypto.Set("randomUUID", func() string { return randomUUID(vm) }); err != nil {
		return err
	}
	globals := map[string]any{"btoa": encode, "atob": decode, "crypto": crypto}
	if bridge != nil {
		globals[hostSendName] = func(request string) string {
			response, err := bridge(request)
			if err != nil {
				panic(vm.NewGoError(err))
			}
			return response
		}
	}
	for name, value := range globals {
		if err := vm.Set(name, value); err != nil {
			return err
		}
	}
	return nil
}
