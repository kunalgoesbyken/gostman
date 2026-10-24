package engine

import (
	cryptorand "crypto/rand"
	"fmt"
	"math/rand/v2"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

const (
	promptPrefix       = "?"
	dynamicSizeBound   = 256
	maxRandomIntSpan   = 1 << 31
	defaultRandomLimit = 1000
	hexDigits          = "0123456789abcdef"
	alphaNumerics      = "abcdefghijklmnopqrstuvwxyz0123456789"
)

var randomIntRangeRe = regexp.MustCompile(`^\$randomInt\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$`)

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
		return nil, fmt.Errorf("headers are not valid: %w", err)
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

func newGUID() string {
	var raw [16]byte
	if _, err := cryptorand.Read(raw[:]); err != nil {
		for i := range raw {
			raw[i] = byte(rand.IntN(256))
		}
	}
	raw[6] = raw[6]&0x0f | 0x40
	raw[8] = raw[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", raw[0:4], raw[4:6], raw[6:8], raw[8:10], raw[10:])
}

func randomIntBetween(low, high int64) (string, bool) {
	if low > high {
		low, high = high, low
	}
	span := high - low + 1
	if span <= 0 || span > maxRandomIntSpan {
		return "", false
	}
	return strconv.FormatInt(low+rand.Int64N(span), 10), true
}

func isDynamicName(name string) bool {
	_, ok := generatorOf(name)
	return ok || randomIntRangeRe.MatchString(name)
}

func dynamicValue(name string) (string, bool) {
	if generate, ok := generatorOf(name); ok {
		return generate(), true
	}
	if found := randomIntRangeRe.FindStringSubmatch(name); found != nil {
		low, lowErr := strconv.ParseInt(found[1], 10, 64)
		high, highErr := strconv.ParseInt(found[2], 10, 64)
		if lowErr == nil && highErr == nil {
			return randomIntBetween(low, high)
		}
	}
	return "", false
}
