package engine

import (
	"math/rand/v2"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	promptPrefix       = "?"
	dynamicPrefix      = "$"
	maxRandomIntSpan   = 1 << 31
	defaultRandomLimit = 1000
	hexDigits          = "0123456789abcdef"
	alphaNumerics      = "abcdefghijklmnopqrstuvwxyz0123456789"
)

type Expansion struct {
	substitution *substitution
}

func NewExpansion(variables string) (*Expansion, error) {
	substitution, err := newSubstitution(variables)
	if err != nil {
		return nil, err
	}
	substitution.readingFiles(refusing(errFilesHTTPOnly))
	return &Expansion{substitution}, nil
}

func (e *Expansion) Text(input string) string {
	return e.substitution.apply(input)
}

func (e *Expansion) Headers(raw string, auth Auth) ([]HeaderEntry, error) {
	pairs, err := parsePairs(raw)
	if err != nil {
		return nil, locales.Wrap(locales.EngineRequestHeadersInvalid, nil, err)
	}
	pairs, err = applyAuth(auth, e.Text, substitutePairs(pairs, e.Text), &url.URL{})
	if err != nil {
		return nil, err
	}

	entries := make([]HeaderEntry, 0, len(pairs))
	for _, header := range pairs {
		entries = append(entries, HeaderEntry{Key: header.key, Value: header.value})
	}
	return entries, nil
}

func (e *Expansion) Missing() []string {
	return slices.Clone(e.substitution.missing)
}

func (e *Expansion) Err() error {
	return e.substitution.failure()
}

func ExpandTexts(texts []string, variables string) ([]string, error) {
	expansion, err := NewExpansion(variables)
	if err != nil {
		return nil, err
	}
	filled := make([]string, len(texts))
	for i, text := range texts {
		filled[i] = expansion.Text(text)
	}
	if err := expansion.Err(); err != nil {
		return nil, err
	}
	return filled, nil
}

func FillVariables(values map[string]string) map[string]string {
	substitution := substitutionOf(values)
	substitution.generates = false
	filled := make(map[string]string, len(values))
	for name, value := range values {
		substitution.expansions = 0
		if expanded, ok := substitution.nested(name, value); ok {
			value = expanded
		}
		filled[name] = value
	}
	return filled
}

func PlaceholderSpans(text string) [][]int {
	return placeholderRe.FindAllStringIndex(text, -1)
}

func PromptName(name string) (string, bool) {
	if strings.HasPrefix(name, promptPrefix) && len(name) > len(promptPrefix) {
		return strings.TrimSpace(name[len(promptPrefix):]), true
	}
	return "", false
}

func pick(options []string) string {
	return options[rand.IntN(len(options))]
}

func randomFrom(alphabet string, length int) string {
	out := make([]byte, length)
	for i := range out {
		out[i] = alphabet[rand.IntN(len(alphabet))]
	}
	return string(out)
}

func randomEmail() string {
	return strings.ToLower(pick(firstNames)) + "." + strings.ToLower(pick(lastNames)) + strconv.Itoa(rand.IntN(1000)) + "@" + pick(mailHosts)
}

func IsDynamicVariable(name string) bool {
	_, known, err := dynamicValue(name)
	return known && err == nil
}

func dynamicValue(name string) (string, bool, error) {
	if invocation, isCall := parseCall(name); isCall {
		generate, known := calledGenerators[builtIns.canonical(invocation.name)]
		if !known {
			return "", false, nil
		}
		value, err := generate(invocation.argument)
		return value, true, err
	}
	if generate, known := generatorOf(name); known {
		return generate(), true, nil
	}
	return "", false, nil
}
