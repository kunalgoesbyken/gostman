package importer

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"hash"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	templateTagClose   = "%}"
	encodedFilterMark  = "b64::"
	encodedFilterClose = "::46b"
	filterMark         = "|"
)

var (
	nowFormats = map[string]string{"": "$isoTimestamp", "iso-8601": "$isoTimestamp", "millis": "$timestampMs", "ms": "$timestampMs", "unix": "$timestamp", "seconds": "$timestamp", "s": "$timestamp"}
	formatTags = setOf("now", "response")
	hashers    = map[string]func() hash.Hash{"md5": md5.New, "sha1": sha1.New, "sha256": sha256.New, "sha512": sha512.New}
)

type idLink struct {
	requestID string
	rule      extractor
}

type insomniaTemplates struct {
	names    map[string]string
	owner    string
	links    []idLink
	files    []string
	prompts  []row
	unmapped map[string][]string
}

func newInsomniaTemplates(names map[string]string) *insomniaTemplates {
	return &insomniaTemplates{names: names, unmapped: map[string][]string{}}
}

func (t *insomniaTemplates) convert(source string) string {
	var out strings.Builder
	for {
		start, closer := nextTemplate(source)
		if start < 0 {
			break
		}
		end := strings.Index(source[start+2:], closer)
		if end < 0 {
			break
		}
		inner := source[start+2 : start+2+end]
		whole := source[start : start+2+end+len(closer)]
		out.WriteString(source[:start])
		if closer == templateTagClose {
			out.WriteString(t.tag(inner, whole))
		} else {
			out.WriteString(t.variable(inner, whole))
		}
		source = source[start+len(whole):]
	}
	out.WriteString(source)
	return out.String()
}

func nextTemplate(source string) (int, string) {
	variable, tag := strings.Index(source, variableOpen), strings.Index(source, templateTagOpen)
	switch {
	case tag >= 0 && (variable < 0 || tag < variable):
		return tag, templateTagClose
	case variable >= 0:
		return variable, variableClose
	}
	return -1, ""
}

func (t *insomniaTemplates) variable(inner, whole string) string {
	name := strings.TrimSpace(inner)
	if strings.Contains(name, filterMark) {
		t.keep(filterMark)
		return whole
	}
	if reference, found := strings.CutPrefix(name, insomniaVariableRoot); found {
		return variableOpen + reference + variableClose
	}
	if reference, found := quotedReference(name); found {
		return variableOpen + reference + variableClose
	}
	return variableOpen + inner + variableClose
}

func (t *insomniaTemplates) keep(name string) {
	t.unmapped[name] = appendUnique(t.unmapped[name], t.owner)
}

func (t *insomniaTemplates) tag(inner, whole string) string {
	tag, parsed := parseTemplateTag(inner)
	if !parsed {
		t.keep(templateTagOpen + " " + (&tagScanner{source: strings.TrimSpace(inner)}).word() + " " + templateTagClose)
		return whole
	}
	if replacement, mapped := t.mapped(tag); mapped {
		return replacement
	}
	t.keep(tagLabel(tag))
	return whole
}

func tagLabel(tag templateTag) string {
	if format := tag.arg(0); formatTags[tag.name] && format != "" {
		return tag.name + " '" + format + "'"
	}
	return tag.name
}

func (t *insomniaTemplates) mapped(tag templateTag) (string, bool) {
	switch tag.name {
	case "uuid":
		return dynamic("$randomUUID"), true
	case "now":
		format, known := nowFormats[strings.ToLower(tag.arg(0))]
		return dynamic(format), known
	case "timestamp":
		return dynamic("$timestampMs"), true
	case "faker":
		name := "$" + tag.arg(0)
		return dynamic(name), tag.arg(0) != "" && engine.IsDynamicVariable(name)
	case "prompt":
		return t.promptVariable(tag)
	case "file":
		return t.fileVariable(tag.arg(0))
	case "base64":
		return encodedLiteral(tag)
	case "hash":
		return hashedLiteral(tag)
	case "response":
		return t.responseVariable(tag)
	}
	return "", false
}

func dynamic(name string) string {
	return variableOpen + name + variableClose
}

func (t *insomniaTemplates) promptVariable(tag templateTag) (string, bool) {
	label := strings.TrimSpace(tag.arg(1))
	if label == "" {
		label = strings.TrimSpace(tag.arg(0))
	}
	label = strings.NewReplacer("{", "", "}", "").Replace(label)
	if fallback := tag.arg(2); label != "" && fallback != "" && literal(fallback) {
		t.prompts = withRow(t.prompts, row{Key: label, Value: fallback, Enabled: true})
	}
	return variableOpen + "?" + label + variableClose, label != ""
}

func withRow(rows []row, added row) []row {
	for _, existing := range rows {
		if existing.Key == added.Key {
			return rows
		}
	}
	return append(rows, added)
}

func (t *insomniaTemplates) takePrompts() []row {
	prompts := t.prompts
	t.prompts = nil
	return prompts
}

func (t *insomniaTemplates) fileVariable(location string) (string, bool) {
	if location == "" || strings.ContainsAny(location, "(){}") {
		return "", false
	}
	t.files = appendUnique(t.files, t.owner)
	return variableOpen + "$file(" + location + ")" + variableClose, true
}

func literal(value string) bool {
	return !strings.Contains(value, variableOpen) && !strings.Contains(value, templateTagOpen)
}

func encodedLiteral(tag templateTag) (string, bool) {
	action, kind, value := tag.arg(0), tag.arg(1), tag.arg(2)
	if !literal(value) {
		return "", false
	}
	encoding := base64.StdEncoding
	switch kind {
	case "", "normal":
	case "url":
		encoding = base64.RawURLEncoding
	default:
		return "", false
	}
	switch action {
	case "encode":
		return encoding.EncodeToString([]byte(value)), true
	case "decode":
		decoded, err := encoding.DecodeString(value)
		return string(decoded), err == nil && literal(string(decoded))
	}
	return "", false
}

func hashedLiteral(tag templateTag) (string, bool) {
	newHash, known := hashers[tag.arg(0)]
	value := tag.arg(2)
	if !known || !literal(value) {
		return "", false
	}
	digest := newHash()
	digest.Write([]byte(value))
	sum := digest.Sum(nil)
	switch tag.arg(1) {
	case "", "hex":
		return hex.EncodeToString(sum), true
	case "base64":
		return base64.StdEncoding.EncodeToString(sum), true
	}
	return "", false
}

func (t *insomniaTemplates) responseVariable(tag templateTag) (string, bool) {
	field, requestID, filter := tag.arg(0), tag.arg(1), decodedFilter(tag.arg(2))
	requestName, known := t.names[requestID]
	if !known {
		return "", false
	}
	var rule extractor
	switch {
	case field == "body" && filter == "":
		rule = extractor{Name: linkName(requestName, bodySegment), Source: sourceBody, Expression: jsonPathRoot}
	case field == "body" && strings.HasPrefix(filter, jsonPathRoot):
		rule = extractor{Name: linkName(requestName, strings.TrimPrefix(filter, jsonPathRoot)), Source: sourceBody, Expression: filter}
	case field == "header" && filter != "":
		rule = extractor{Name: linkName(requestName, filter), Source: sourceHeader, Expression: filter}
	default:
		return "", false
	}
	rule.Enabled, rule.Scope = true, scopeSession
	t.links = append(t.links, idLink{requestID: requestID, rule: rule})
	return variableOpen + rule.Name + variableClose, true
}

func decodedFilter(filter string) string {
	inner, found := strings.CutPrefix(filter, encodedFilterMark)
	if !found {
		return strings.TrimSpace(filter)
	}
	inner, _ = strings.CutSuffix(inner, encodedFilterClose)
	decoded, err := base64.StdEncoding.DecodeString(inner)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(decoded))
}
