package locales

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
)

//go:generate go run ./codegen

//go:embed en/*Messages.json
var english embed.FS

const (
	pluralOne     = "_one"
	pluralOther   = "_other"
	countParam    = "count"
	detailParam   = "detail"
	codeSeparator = "."
	detailBreak   = "\n\n"
)

type Code string

type Params map[string]any

type Message struct {
	Code   Code   `json:"code"`
	Params Params `json:"params,omitempty"`
	Detail string `json:"detail,omitempty"`
}

type List struct {
	Items []string `json:"items"`
	Type  string   `json:"type,omitempty"`
}

func Unit(items []string) List {
	return List{Items: items, Type: "unit"}
}

func Either(items []string) List {
	return List{Items: items, Type: "disjunction"}
}

func New(code Code, params Params) Message {
	return Message{Code: code, Params: params}
}

func (m Message) WithDetail(detail string) Message {
	m.Detail = detail
	return m
}

func (m Message) English() string {
	template, found := templateFor(m.Code, m.Params)
	if !found {
		return string(m.Code)
	}
	return render(template, m.Params, m.Detail)
}

func (m Message) String() string {
	text := m.English()
	if m.Detail == "" || usesDetail(m.Code, m.Params) {
		return text
	}
	return text + detailBreak + m.Detail
}

type Error struct {
	Message Message
	Err     error
}

func (e *Error) Error() string {
	return e.Message.String()
}

func (e *Error) Unwrap() error {
	return e.Err
}

func Errorf(code Code, params Params) error {
	return &Error{Message: New(code, params)}
}

func Wrap(code Code, params Params, err error) error {
	return &Error{Message: New(code, params).WithDetail(err.Error()), Err: err}
}

func Caused(code Code, params Params, cause error) error {
	return &Error{Message: New(code, params), Err: cause}
}

func Find(err error) *Message {
	var found *Error
	if errors.As(err, &found) {
		message := found.Message
		return &message
	}
	return nil
}

func Whole(err error) *Message {
	message := Find(err)
	if message == nil || message.String() != err.Error() {
		return nil
	}
	return message
}

var (
	catalogue     map[string]map[string]any
	catalogueOnce sync.Once
)

func loadCatalogue() {
	catalogue = map[string]map[string]any{}
	entries, err := english.ReadDir("en")
	if err != nil {
		return
	}
	for _, entry := range entries {
		data, err := english.ReadFile("en/" + entry.Name())
		if err != nil {
			continue
		}
		var tree map[string]any
		if json.Unmarshal(data, &tree) == nil {
			catalogue[strings.TrimSuffix(entry.Name(), ".json")] = tree
		}
	}
}

func lookup(code Code) (map[string]any, string, bool) {
	catalogueOnce.Do(loadCatalogue)
	namespace, path, found := strings.Cut(string(code), codeSeparator)
	tree, known := catalogue[namespace]
	return tree, path, found && known
}

func templateFor(code Code, params Params) (string, bool) {
	tree, path, ok := lookup(code)
	if !ok {
		return "", false
	}
	parent, name := descend(tree, path)
	if parent == nil {
		return "", false
	}
	if text, plain := parent[name].(string); plain {
		return text, true
	}
	suffix := pluralOther
	if isOne(params[countParam]) {
		suffix = pluralOne
	}
	text, plural := parent[name+suffix].(string)
	return text, plural
}

func descend(tree map[string]any, path string) (map[string]any, string) {
	segments := strings.Split(path, codeSeparator)
	current := tree
	for _, segment := range segments[:len(segments)-1] {
		next, ok := current[segment].(map[string]any)
		if !ok {
			return nil, ""
		}
		current = next
	}
	return current, segments[len(segments)-1]
}

func isOne(value any) bool {
	switch count := value.(type) {
	case int:
		return count == 1
	case int64:
		return count == 1
	case string:
		return count == "1"
	}
	return false
}

func usesDetail(code Code, params Params) bool {
	template, found := templateFor(code, params)
	return found && strings.Contains(template, "{{"+detailParam+"}}")
}

func render(template string, params Params, detail string) string {
	var out strings.Builder
	for {
		start := strings.Index(template, "{{")
		end := strings.Index(template, "}}")
		if start < 0 || end < start {
			out.WriteString(template)
			return out.String()
		}
		out.WriteString(template[:start])
		name := template[start+2 : end]
		if name == detailParam && detail != "" {
			out.WriteString(detail)
		} else {
			out.WriteString(show(params[name]))
		}
		template = template[end+2:]
	}
}

func show(value any) string {
	switch shown := value.(type) {
	case nil:
		return ""
	case string:
		return shown
	case []string:
		return joinWords(shown, " and ")
	case List:
		return showList(shown)
	case Message:
		return shown.English()
	case *Message:
		return shown.English()
	}
	return fmt.Sprint(value)
}

func showList(list List) string {
	switch list.Type {
	case "unit":
		return strings.Join(list.Items, ", ")
	case "disjunction":
		return joinWords(list.Items, " or ")
	}
	return joinWords(list.Items, " and ")
}

func joinWords(items []string, conjunction string) string {
	if len(items) < 2 {
		return strings.Join(items, "")
	}
	return strings.Join(items[:len(items)-1], ", ") + conjunction + items[len(items)-1]
}
