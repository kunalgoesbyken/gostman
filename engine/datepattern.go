package engine

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

const (
	patternQuote   = '\''
	nanosecondsLen = 9
	hoursOnClock   = 12
	shortNameLen   = 3
)

type patternField func(at time.Time, width int) (string, bool)

var patternFields = map[byte]patternField{
	'y': yearField,
	'M': monthField,
	'd': numberField(2, func(at time.Time) int { return at.Day() }),
	'E': weekdayField,
	'a': meridiemField,
	'H': numberField(2, func(at time.Time) int { return at.Hour() }),
	'h': numberField(2, clockHour),
	'm': numberField(2, func(at time.Time) int { return at.Minute() }),
	's': numberField(2, func(at time.Time) int { return at.Second() }),
	'S': fractionField,
	'X': zoneField,
}

func formatTime(at time.Time, pattern string) (string, error) {
	at = at.UTC()
	var out strings.Builder
	for i := 0; i < len(pattern); {
		switch char := pattern[i]; {
		case char == patternQuote:
			text, next, err := quotedText(pattern, i)
			if err != nil {
				return "", err
			}
			out.WriteString(text)
			i = next
		case isASCIILetter(char):
			width := runLength(pattern, i)
			text, err := fieldText(at, char, width)
			if err != nil {
				return "", err
			}
			out.WriteString(text)
			i += width
		default:
			out.WriteByte(char)
			i++
		}
	}
	return out.String(), nil
}

func fieldText(at time.Time, letter byte, width int) (string, error) {
	field, known := patternFields[letter]
	if !known {
		return "", fmt.Errorf("%q is not a date pattern letter; put plain text inside single quotes", string(letter))
	}
	text, fits := field(at, width)
	if !fits {
		return "", fmt.Errorf("%q cannot be written %d times in a date pattern", string(letter), width)
	}
	return text, nil
}

func quotedText(pattern string, start int) (string, int, error) {
	if start+1 < len(pattern) && pattern[start+1] == patternQuote {
		return string(patternQuote), start + 2, nil
	}
	var text strings.Builder
	for i := start + 1; i < len(pattern); i++ {
		if pattern[i] != patternQuote {
			text.WriteByte(pattern[i])
			continue
		}
		if i+1 < len(pattern) && pattern[i+1] == patternQuote {
			text.WriteByte(patternQuote)
			i++
			continue
		}
		return text.String(), i + 1, nil
	}
	return "", 0, errors.New("a single quote in the date pattern is never closed")
}

func runLength(pattern string, start int) int {
	end := start
	for end < len(pattern) && pattern[end] == pattern[start] {
		end++
	}
	return end - start
}

func isASCIILetter(char byte) bool {
	return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z'
}

func numberField(widest int, value func(time.Time) int) patternField {
	return func(at time.Time, width int) (string, bool) {
		return padded(value(at), width), width <= widest
	}
}

func padded(value, width int) string {
	return fmt.Sprintf("%0*d", width, value)
}

func clockHour(at time.Time) int {
	if hour := at.Hour() % hoursOnClock; hour != 0 {
		return hour
	}
	return hoursOnClock
}

func yearField(at time.Time, width int) (string, bool) {
	if width == 2 {
		return padded(at.Year()%100, width), true
	}
	return padded(at.Year(), width), true
}

func monthField(at time.Time, width int) (string, bool) {
	switch {
	case width <= 2:
		return padded(int(at.Month()), width), true
	case width == shortNameLen:
		return at.Month().String()[:shortNameLen], true
	}
	return at.Month().String(), width == shortNameLen+1
}

func weekdayField(at time.Time, width int) (string, bool) {
	if width <= shortNameLen {
		return at.Weekday().String()[:shortNameLen], true
	}
	return at.Weekday().String(), width == shortNameLen+1
}

func meridiemField(at time.Time, width int) (string, bool) {
	if at.Hour() < hoursOnClock {
		return "AM", width == 1
	}
	return "PM", width == 1
}

func fractionField(at time.Time, width int) (string, bool) {
	if width > nanosecondsLen {
		return "", false
	}
	return padded(at.Nanosecond(), nanosecondsLen)[:width], true
}

func zoneField(_ time.Time, width int) (string, bool) {
	return "Z", width <= shortNameLen
}

var offsetUnits = map[byte]func(at time.Time, count int) time.Time{
	's': func(at time.Time, count int) time.Time { return at.Add(time.Duration(count) * time.Second) },
	'm': func(at time.Time, count int) time.Time { return at.Add(time.Duration(count) * time.Minute) },
	'h': func(at time.Time, count int) time.Time { return at.Add(time.Duration(count) * time.Hour) },
	'd': func(at time.Time, count int) time.Time { return at.AddDate(0, 0, count) },
	'w': func(at time.Time, count int) time.Time { return at.AddDate(0, 0, 7*count) },
	'M': func(at time.Time, count int) time.Time { return at.AddDate(0, count, 0) },
	'y': func(at time.Time, count int) time.Time { return at.AddDate(count, 0, 0) },
}

func parseOffset(text string) (func(time.Time) time.Time, bool) {
	if len(text) < 3 || text[0] != '+' && text[0] != '-' {
		return nil, false
	}
	shift, known := offsetUnits[text[len(text)-1]]
	count, err := strconv.Atoi(text[:len(text)-1])
	if !known || err != nil {
		return nil, false
	}
	return func(at time.Time) time.Time { return shift(at, count) }, true
}
