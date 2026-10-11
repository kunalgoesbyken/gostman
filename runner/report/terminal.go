package report

import "os"

const noColorVariable = "NO_COLOR"

func SupportsColor(file *os.File) bool {
	return os.Getenv(noColorVariable) == "" && acceptsEscapes(file)
}
