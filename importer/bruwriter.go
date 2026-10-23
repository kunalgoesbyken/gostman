package importer

import (
	"strings"
	"unicode"
)

const (
	bruIndent        = "  "
	escapedTerminate = "'' '"
	lineSeparator    = ' '
	paragraphSep     = ' '
)

type bruWriter struct {
	out strings.Builder
}

func (w *bruWriter) dict(name string, entries []bruEntry) {
	w.section(name, dictLines(entries))
}

func (w *bruWriter) section(name, lines string) {
	if lines != "" {
		w.out.WriteString(name + " {\n" + lines + "}\n\n")
	}
}

func listLines(key string, items []string) string {
	var lines strings.Builder
	for _, item := range items {
		if isBrunoListItem(item) {
			lines.WriteString(bruIndent + bruIndent + item + "\n")
		}
	}
	if lines.Len() == 0 {
		return ""
	}
	return bruIndent + key + ": " + listOpen + "\n" + lines.String() + bruIndent + listClose + "\n"
}

func isBrunoListItem(item string) bool {
	return item != "" && strings.IndexFunc(item, func(r rune) bool {
		return !unicode.IsLetter(r) && (r < '0' || r > '9') && r != '_' && r != '-'
	}) < 0
}

func dictLines(entries []bruEntry) string {
	var lines strings.Builder
	for _, entry := range entries {
		key, ok := safeKey(entry.Key)
		if !ok {
			continue
		}
		if !entry.Enabled {
			key = disabledMark + key
		}
		if strings.ContainsAny(entry.Value, "\r\n") {
			lines.WriteString(bruIndent + key + ": " + multilineMark + "\n")
			lines.WriteString(indentLines(guardTerminator(entry.Value), bruIndent+bruIndent) + "\n" + bruIndent + multilineMark + "\n")
			continue
		}
		lines.WriteString(bruIndent + key + ": " + singleLine(entry.Value) + "\n")
	}
	return lines.String()
}

func (w *bruWriter) block(name, body string) {
	if strings.TrimSpace(body) == "" {
		return
	}
	w.out.WriteString(name + " {\n" + indentLines(stripControls(body), bruIndent) + "\n}\n\n")
}

func (w *bruWriter) names(name string, items []string) {
	var kept []string
	for _, item := range items {
		if key, ok := safeKey(item); ok && !strings.Contains(key, ",") {
			kept = append(kept, key)
		}
	}
	if len(kept) > 0 {
		w.out.WriteString(name + " [\n" + bruIndent + strings.Join(kept, ",\n"+bruIndent) + "\n]\n\n")
	}
}

func (w *bruWriter) String() string {
	return strings.TrimRight(w.out.String(), "\n") + "\n"
}

func safeKey(key string) (string, bool) {
	cleaned := strings.TrimSpace(singleLine(key))
	if cleaned == "" || strings.HasPrefix(cleaned, disabledMark) || strings.Contains(cleaned, ":") {
		return "", false
	}
	return cleaned, true
}

func isUnsafeRune(r rune) bool {
	return unicode.IsControl(r) || r == lineSeparator || r == paragraphSep
}

func singleLine(value string) string {
	return strings.Map(func(r rune) rune {
		if isUnsafeRune(r) {
			return ' '
		}
		return r
	}, value)
}

func stripControls(value string) string {
	value = strings.ReplaceAll(strings.ReplaceAll(value, "\r\n", "\n"), "\r", "\n")
	return strings.Map(func(r rune) rune {
		if r != '\n' && r != '\t' && isUnsafeRune(r) {
			return ' '
		}
		return r
	}, value)
}

func guardTerminator(value string) string {
	lines := strings.Split(stripControls(value), "\n")
	for index, line := range lines {
		if strings.TrimSpace(line) == multilineMark {
			lines[index] = strings.Replace(line, multilineMark, escapedTerminate, 1)
		}
	}
	return strings.Join(lines, "\n")
}

func indentLines(body, indent string) string {
	lines := strings.Split(normalizeNewlines(body), "\n")
	for index, line := range lines {
		if line != "" {
			lines[index] = indent + line
		}
	}
	return strings.Join(lines, "\n")
}

func oneLine(name string) string {
	return strings.Join(strings.Fields(singleLine(name)), " ")
}
