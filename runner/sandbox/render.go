package sandbox

import (
	"encoding/json"
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
		return fmt.Errorf("%s took more than %s and was stopped", function, renderLimit)
	}
	if err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(encoded), result); err != nil {
		return fmt.Errorf("%s returned an unexpected value: %w", function, err)
	}
	return nil
}
