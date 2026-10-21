package scan

import (
	"encoding/json"
	"fmt"
	"maps"
	"net/url"
	"slices"
	"strconv"
	"strings"
)

type row struct {
	key   string
	value string
}

type visitor func(path, name, value string)

func labelled(field, name string) string {
	return field + " " + strconv.Quote(name)
}

func stringOf(value any) string {
	text, _ := value.(string)
	return text
}

func parseRows(raw string) []row {
	trimmed := strings.TrimSpace(raw)
	var list []map[string]any
	if json.Unmarshal([]byte(trimmed), &list) == nil {
		rows := make([]row, 0, len(list))
		for _, entry := range list {
			rows = append(rows, row{stringOf(entry["key"]), stringOf(entry["value"])})
		}
		return rows
	}
	return rowsOf(parseObject(trimmed))
}

func rowsOf(object map[string]string) []row {
	rows := make([]row, 0, len(object))
	for _, key := range slices.Sorted(maps.Keys(object)) {
		rows = append(rows, row{key, object[key]})
	}
	return rows
}

func parseObject(raw string) map[string]string {
	var decoded map[string]any
	if json.Unmarshal([]byte(strings.TrimSpace(raw)), &decoded) != nil {
		return nil
	}
	object := make(map[string]string, len(decoded))
	for key, value := range decoded {
		if text, isText := value.(string); isText {
			object[key] = text
		}
	}
	return object
}

func walkJSON(raw string, visit visitor) bool {
	var decoded any
	if json.Unmarshal([]byte(strings.TrimSpace(raw)), &decoded) != nil {
		return false
	}
	walk(decoded, "", "", visit)
	return true
}

func walk(node any, path, name string, visit visitor) {
	switch value := node.(type) {
	case string:
		visit(path, name, value)
	case map[string]any:
		for _, key := range slices.Sorted(maps.Keys(value)) {
			walk(value[key], joinPath(path, key), key, visit)
		}
	case []any:
		for index, item := range value {
			walk(item, fmt.Sprintf("%s[%d]", path, index), name, visit)
		}
	}
}

func joinPath(path, key string) string {
	if path == "" {
		return key
	}
	return path + "." + key
}

func queryPairs(query string) []row {
	query, _, _ = strings.Cut(query, "#")
	var pairs []row
	for _, part := range strings.Split(query, "&") {
		key, value, _ := strings.Cut(part, "=")
		if key != "" {
			pairs = append(pairs, row{unescape(key), unescape(value)})
		}
	}
	return pairs
}

func unescape(text string) string {
	decoded, err := url.QueryUnescape(text)
	if err != nil {
		return text
	}
	return decoded
}
