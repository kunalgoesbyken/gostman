package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"mime"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	keptResponses   = 100
	keptBodyBytes   = 64 << 10
	shownDifference = 50
	shownValue      = 120
	rootPath        = "$"

	changeMissing    = "missing"
	changeUnexpected = "unexpected"
	changeType       = "type"
	changeValue      = "value"
	changeText       = "text"
)

type record struct {
	at       time.Time
	response engine.Response
	failure  string
}

type responseLog struct {
	mu    sync.Mutex
	order []string
	kept  map[string]record
}

type savedExample struct {
	Name         string `json:"name"`
	Status       int    `json:"status"`
	Body         string `json:"body"`
	BodyEncoding string `json:"bodyEncoding"`
	ContentType  string `json:"contentType"`
	IsDefault    bool   `json:"isDefault"`
}

type responseArguments struct {
	Request        string `json:"request"`
	Example        string `json:"example"`
	ShapeOnly      bool   `json:"shape_only"`
	Select         string `json:"select"`
	MaxBodyBytes   int    `json:"max_body_bytes"`
	IncludeHeaders bool   `json:"include_headers"`
}

type difference struct {
	Path     string `json:"path"`
	Change   string `json:"change"`
	Expected any    `json:"expected,omitempty"`
	Actual   any    `json:"actual,omitempty"`
}

type comparison struct {
	Example            string       `json:"example"`
	Matches            bool         `json:"matches"`
	ExpectedStatus     int          `json:"expectedStatus"`
	StatusMatches      bool         `json:"statusMatches"`
	ContentTypeMatches bool         `json:"contentTypeMatches"`
	BodyMatches        bool         `json:"bodyMatches"`
	Differences        []difference `json:"differences,omitempty"`
	MoreDifferences    int          `json:"moreDifferences,omitempty"`
}

type responseReport struct {
	Request     string               `json:"request"`
	ReceivedAt  time.Time            `json:"receivedAt"`
	Status      string               `json:"status"`
	StatusCode  int                  `json:"statusCode"`
	DurationMs  int64                `json:"durationMs"`
	ContentType string               `json:"contentType"`
	Error       string               `json:"error,omitempty"`
	Headers     []engine.HeaderEntry `json:"headers,omitempty"`
	Body        BodySummary          `json:"body"`
	Comparison  *comparison          `json:"comparison,omitempty"`
	Text        string               `json:"-"`
}

type differ struct {
	shapeOnly bool
	clean     func(string) string
	found     []difference
	more      int
}

func (r responseReport) Attachment() string {
	return r.Text
}

func (r responseReport) Embed(text string) any {
	r.Body.Text = text
	return r
}

func trimmed(response engine.Response) engine.Response {
	if len(response.Body) > keptBodyBytes {
		response.Body, response.Truncated = response.Body[:keptBodyBytes], true
	}
	response.Cookies, response.Timeline = nil, nil
	return response
}

func received(response engine.Response) record {
	kept := record{at: time.Now(), response: trimmed(response)}
	if response.Error != "" {
		kept.failure = response.Body
	}
	return kept
}

func captured(result runner.Result) record {
	exchanged := result.Exchange.Response
	return record{at: time.Now(), failure: result.Error, response: engine.Response{
		Status:       result.Status,
		StatusCode:   result.StatusCode,
		Headers:      exchanged.Headers,
		Body:         exchanged.Body,
		BodyEncoding: engine.EncodingUTF8,
		ContentType:  exchanged.ContentType,
		Size:         exchanged.Size,
		DurationMs:   result.DurationMs,
		Truncated:    exchanged.Truncated,
	}}
}

func (l *responseLog) record(id string, entry record) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.kept == nil {
		l.kept = map[string]record{}
	}
	l.order = append(slices.DeleteFunc(l.order, func(kept string) bool { return kept == id }), id)
	l.kept[id] = entry
	if len(l.order) > keptResponses {
		delete(l.kept, l.order[0])
		l.order = l.order[1:]
	}
}

func (l *responseLog) find(id string) (record, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	entry, found := l.kept[id]
	return entry, found
}

func savedExamples(request workspace.Request) []savedExample {
	var examples []savedExample
	if json.Unmarshal([]byte(request.Examples), &examples) != nil {
		return nil
	}
	return examples
}

func chooseExample(examples []savedExample, name string) (savedExample, error) {
	if name != "" {
		for _, example := range examples {
			if strings.EqualFold(example.Name, name) {
				return example, nil
			}
		}
		return savedExample{}, fmt.Errorf("The request has no saved example named %q; get_request lists its examples.", name)
	}
	for _, example := range examples {
		if example.IsDefault {
			return example, nil
		}
	}
	return examples[0], nil
}

func mediaType(contentType string) string {
	parsed, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return strings.ToLower(strings.TrimSpace(contentType))
	}
	return parsed
}

func (d *differ) clipped(value any) any {
	switch shown := value.(type) {
	case string:
		cleaned := d.clean(shown)
		if len(cleaned) > shownValue {
			return cleaned[:shownValue] + "..."
		}
		return cleaned
	case map[string]any, []any:
		return nil
	}
	return value
}

func kindOf(value any) string {
	switch value.(type) {
	case nil:
		return "null"
	case map[string]any:
		return "object"
	case []any:
		return "array"
	case string:
		return "string"
	case bool:
		return "boolean"
	default:
		return "number"
	}
}

func (d *differ) note(path, change string, expected, actual any) {
	if len(d.found) >= shownDifference {
		d.more++
		return
	}
	d.found = append(d.found, difference{Path: path, Change: change, Expected: d.clipped(expected), Actual: d.clipped(actual)})
}

func (d *differ) compare(path string, expected, actual any) {
	if kindOf(expected) != kindOf(actual) {
		d.note(path, changeType, kindOf(expected), kindOf(actual))
		return
	}
	switch wanted := expected.(type) {
	case map[string]any:
		d.objects(path, wanted, actual.(map[string]any))
	case []any:
		d.arrays(path, wanted, actual.([]any))
	default:
		if !d.shapeOnly && fmt.Sprint(expected) != fmt.Sprint(actual) {
			d.note(path, changeValue, expected, actual)
		}
	}
}

func (d *differ) objects(path string, expected, actual map[string]any) {
	names := make([]string, 0, len(expected)+len(actual))
	for name := range expected {
		names = append(names, name)
	}
	for name := range actual {
		if _, shared := expected[name]; !shared {
			names = append(names, name)
		}
	}
	for _, name := range sorted(names) {
		wanted, present := expected[name]
		got, returned := actual[name]
		member := path + "." + name
		switch {
		case !returned:
			d.note(member, changeMissing, wanted, nil)
		case !present:
			d.note(member, changeUnexpected, nil, got)
		default:
			d.compare(member, wanted, got)
		}
	}
}

func (d *differ) arrays(path string, expected, actual []any) {
	if d.shapeOnly {
		if len(expected) > 0 && len(actual) > 0 {
			d.compare(path+"[0]", expected[0], actual[0])
		}
		return
	}
	for index := range max(len(expected), len(actual)) {
		item := fmt.Sprintf("%s[%d]", path, index)
		switch {
		case index >= len(actual):
			d.note(item, changeMissing, expected[index], nil)
		case index >= len(expected):
			d.note(item, changeUnexpected, nil, actual[index])
		default:
			d.compare(item, expected[index], actual[index])
		}
	}
}

func decodeDocument(text string) (any, bool) {
	decoder := json.NewDecoder(strings.NewReader(text))
	decoder.UseNumber()
	var document any
	if decoder.Decode(&document) != nil || decoder.More() {
		return nil, false
	}
	return document, true
}

func compareBodies(expected, actual string, shapeOnly bool, clean func(string) string) differ {
	found := differ{shapeOnly: shapeOnly, clean: clean}
	wanted, wantedJSON := decodeDocument(expected)
	got, gotJSON := decodeDocument(actual)
	switch {
	case wantedJSON && gotJSON:
		found.compare(rootPath, wanted, got)
	case !shapeOnly && strings.TrimSpace(expected) != strings.TrimSpace(actual):
		found.note(rootPath, changeText, expected, actual)
	case shapeOnly && wantedJSON != gotJSON:
		found.note(rootPath, changeType, kindName(wantedJSON), kindName(gotJSON))
	}
	return found
}

func kindName(isJSON bool) string {
	if isJSON {
		return "json"
	}
	return "text"
}

func compareWith(example savedExample, response engine.Response, shapeOnly bool, clean func(string) string) comparison {
	result := comparison{
		Example:            example.Name,
		ExpectedStatus:     example.Status,
		StatusMatches:      example.Status == 0 || example.Status == response.StatusCode,
		ContentTypeMatches: example.ContentType == "" || mediaType(example.ContentType) == mediaType(response.ContentType),
	}
	if example.BodyEncoding != engine.EncodingBase64 && response.BodyEncoding != engine.EncodingBase64 {
		found := compareBodies(example.Body, response.Body, shapeOnly, clean)
		result.Differences, result.MoreDifferences = found.found, found.more
	} else if example.Body != response.Body {
		result.Differences = []difference{{Path: rootPath, Change: changeValue}}
	}
	result.BodyMatches = len(result.Differences) == 0
	result.Matches = result.StatusMatches && result.ContentTypeMatches && result.BodyMatches
	return result
}

func (d *Desk) lastResponse(_ context.Context, current scene, arguments responseArguments) (responseReport, error) {
	if !hasText(arguments.Request) {
		return responseReport{}, errors.New("Name the request by id or name; list_requests shows both.")
	}
	entry, err := d.find(current.stored, arguments.Request)
	if err != nil {
		return responseReport{}, err
	}
	kept, found := d.responses.find(entry.Request.ID)
	if !found {
		return responseReport{}, fmt.Errorf("%s has not been sent in this session; send it with send_request or run_folder first.", entry.QualifiedName())
	}
	response := kept.response
	view := View{Select: arguments.Select, MaxBodyBytes: arguments.MaxBodyBytes}
	summary, text := d.client.shownBody(response, view)
	report := responseReport{
		Request:     entry.QualifiedName(),
		ReceivedAt:  kept.at,
		Status:      response.Status,
		StatusCode:  response.StatusCode,
		DurationMs:  response.DurationMs,
		ContentType: response.ContentType,
		Error:       kept.failure,
		Body:        summary,
		Text:        text,
	}
	if arguments.IncludeHeaders {
		report.Headers = maskHeaders(response.Headers, always)
	}
	examples := savedExamples(storedRequest(current.files, entry.Request.ID))
	if len(examples) == 0 {
		return report, nil
	}
	example, err := chooseExample(examples, arguments.Example)
	if err != nil {
		return responseReport{}, err
	}
	compared := compareWith(example, response, arguments.ShapeOnly, d.client.Text)
	report.Comparison = &compared
	return report, nil
}
