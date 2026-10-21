package sandbox

import (
	"errors"
	"fmt"
	"time"
)

const renderLimit = 5 * time.Minute

func Render(function string, result any, arguments ...any) error {
	renderer, err := boot(nil)
	if err != nil {
		return err
	}
	encoded, err := renderer.invoke(function, renderLimit, arguments)
	if errors.Is(err, errExpired) {
		return fmt.Errorf("the operation took more than %s and was stopped", renderLimit)
	}
	if err != nil {
		return err
	}
	return decodeResult(encoded, result)
}
