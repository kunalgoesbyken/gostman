package engine

import (
	"errors"
	"fmt"
	"math"
	"math/rand/v2"
	"strconv"
	"strings"
	"time"
)

const (
	callOpen             = '('
	callClose            = ')'
	argumentSeparator    = ","
	defaultFloatDecimals = 2
	maxFloatDecimals     = 15
)

type call struct {
	name     string
	argument string
}

func parseCall(text string) (call, bool) {
	open := strings.IndexByte(text, callOpen)
	if open < 0 || text[len(text)-1] != callClose {
		return call{}, false
	}
	return call{name: text[:open], argument: text[open+1 : len(text)-1]}, true
}

type moment struct {
	at      func() time.Time
	layout  string
	offsets bool
}

var moments = map[string]moment{
	"$date":             {time.Now, dateLayout, true},
	"$isoTimestamp":     {time.Now, isoLayout, false},
	"$randomDateFuture": {func() time.Time { return shifted(year) }, isoLayout, false},
	"$randomDatePast":   {func() time.Time { return shifted(-year) }, isoLayout, false},
	"$randomDateRecent": {func() time.Time { return shifted(-day) }, isoLayout, false},
	"$randomDateSoon":   {func() time.Time { return shifted(day) }, isoLayout, false},
	"$randomBirthdate":  {randomBirthdate, dateLayout, false},
}

var calledGenerators = buildCalledGenerators()

func buildCalledGenerators() map[string]func(argument string) (string, error) {
	generators := map[string]func(string) (string, error){
		"$randomInt":   randomIntArgument,
		"$randomFloat": randomFloatArgument,
	}
	for name, source := range moments {
		generators[name] = source.written
	}
	return generators
}

func (m moment) plain() string {
	return m.at().UTC().Format(m.layout)
}

func (m moment) written(argument string) (string, error) {
	at, pattern := m.at(), strings.TrimSpace(argument)
	if m.offsets {
		head, rest, _ := strings.Cut(argument, argumentSeparator)
		if shift, isOffset := parseOffset(strings.TrimSpace(head)); isOffset {
			at, pattern = shift(at), strings.TrimSpace(rest)
		}
	}
	if pattern == "" {
		return at.UTC().Format(m.layout), nil
	}
	return formatTime(at, pattern)
}

func shifted(span time.Duration) time.Time {
	offset := time.Duration(rand.Int64N(int64(absDuration(span)))) + time.Second
	if span < 0 {
		offset = -offset
	}
	return time.Now().Add(offset)
}

func absDuration(span time.Duration) time.Duration {
	if span < 0 {
		return -span
	}
	return span
}

func randomBirthdate() time.Time {
	age := 18 + rand.IntN(63)
	return time.Now().UTC().AddDate(-age, 0, -rand.IntN(365))
}

func listOf(argument string) []string {
	items := strings.Split(argument, argumentSeparator)
	for i, item := range items {
		items[i] = strings.TrimSpace(item)
	}
	return items
}

func randomIntArgument(argument string) (string, error) {
	items := listOf(argument)
	if len(items) != 2 {
		return "", errors.New("write it as {{$randomInt(min,max)}}")
	}
	low, lowErr := strconv.ParseInt(items[0], 10, 64)
	high, highErr := strconv.ParseInt(items[1], 10, 64)
	if lowErr != nil || highErr != nil {
		return "", errors.New("the minimum and the maximum must be whole numbers, as in {{$randomInt(1,100)}}")
	}
	return randomIntBetween(low, high)
}

func randomIntBetween(low, high int64) (string, error) {
	if low > high {
		low, high = high, low
	}
	span := high - low + 1
	if span <= 0 || span > maxRandomIntSpan {
		return "", fmt.Errorf("the range can hold at most %d whole numbers", int64(maxRandomIntSpan))
	}
	return strconv.FormatInt(low+rand.Int64N(span), 10), nil
}

func randomFloatArgument(argument string) (string, error) {
	items := listOf(argument)
	if len(items) != 2 && len(items) != 3 {
		return "", errors.New("write it as {{$randomFloat(min,max)}} or {{$randomFloat(min,max,decimals)}}")
	}
	low, lowErr := parseFiniteFloat(items[0])
	high, highErr := parseFiniteFloat(items[1])
	if lowErr != nil || highErr != nil {
		return "", errors.New("the minimum and the maximum must be numbers, as in {{$randomFloat(0,1)}}")
	}
	decimals := defaultFloatDecimals
	if len(items) == 3 {
		var err error
		if decimals, err = strconv.Atoi(items[2]); err != nil || decimals < 0 || decimals > maxFloatDecimals {
			return "", fmt.Errorf("the number of decimals must be a whole number from 0 to %d", maxFloatDecimals)
		}
	}
	return randomFloatBetween(low, high, decimals), nil
}

func parseFiniteFloat(text string) (float64, error) {
	value, err := strconv.ParseFloat(text, 64)
	if err == nil && (math.IsNaN(value) || math.IsInf(value, 0)) {
		return 0, errors.New("not a finite number")
	}
	return value, err
}

func randomFloatBetween(low, high float64, decimals int) string {
	if low > high {
		low, high = high, low
	}
	return strconv.FormatFloat(low+rand.Float64()*(high-low), 'f', decimals, 64)
}
