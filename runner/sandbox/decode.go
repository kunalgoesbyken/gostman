package sandbox

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var errUnreadable = errors.New("the data could not be read")

func decodeResult(encoded string, result any) error {
	err := json.Unmarshal([]byte(encoded), result)
	if err == nil {
		return nil
	}
	var mismatch *json.UnmarshalTypeError
	if errors.As(err, &mismatch) && mismatch.Field != "" {
		return fmt.Errorf("the field %q has the wrong type (found %s)", strings.TrimLeft(mismatch.Field, "."), mismatch.Value)
	}
	return errUnreadable
}
