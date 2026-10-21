package redact

func MapSensitive(node any, replace func(name, value string) string) bool {
	changed := false
	switch value := node.(type) {
	case map[string]any:
		for name, member := range value {
			if text, isText := member.(string); isText && text != "" && IsSensitiveName(name) {
				value[name], changed = replace(name, text), true
				continue
			}
			changed = MapSensitive(member, replace) || changed
		}
	case []any:
		for _, member := range value {
			changed = MapSensitive(member, replace) || changed
		}
	}
	return changed
}
