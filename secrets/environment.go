package secrets

import (
	"fmt"
	"strings"
	"unicode"
)

const (
	environmentPrefix = "GOSTMAN_SECRETS_"
	environmentKind   = "KIND"
)

type Environment func(name string) (string, bool)

type naming struct {
	prefix     string
	isStandard bool
}

func (e Environment) first(names []string) string {
	for _, name := range names {
		if value, found := e(name); found && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func variableSegment(alias string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			return unicode.ToUpper(r)
		}
		return '_'
	}, alias)
}

func (n naming) variables(field Field) []string {
	names := []string{n.prefix + strings.ToUpper(field.Name)}
	if n.isStandard {
		names = append(names, field.Env...)
	}
	return names
}

func (n naming) all(info KindInfo) string {
	names := make([]string, len(info.Fields))
	for i, field := range info.Fields {
		names[i] = n.variables(field)[0]
		if n.isStandard && len(field.Env) > 0 {
			names[i] = field.Env[0]
		}
	}
	return strings.Join(names, ", ")
}

func (e Environment) Lookup() Lookup {
	return func(alias string) (Connection, error) {
		prefix := environmentPrefix + variableSegment(alias) + "_"
		kindName, declared := e(prefix + environmentKind)
		if !declared {
			kindName = alias
		}
		entry, found := kindNamed(strings.TrimSpace(kindName))
		if !found {
			return Connection{}, fmt.Errorf("there is no connection named %q: set %s%s to %s and add its settings, or name the connection after its kind to use the standard variables", alias, prefix, environmentKind, KindNames())
		}
		return e.connection(alias, entry, naming{prefix: prefix, isStandard: !declared})
	}
}

func (e Environment) connection(alias string, entry kind, names naming) (Connection, error) {
	connection := Connection{Alias: alias, Kind: entry.info.Name, Values: map[string]string{}}
	for _, field := range entry.info.Fields {
		value := e.first(names.variables(field))
		if value == "" && field.Required {
			return Connection{}, fmt.Errorf("connection %q needs %s: set %s", alias, readable(field.Name), strings.Join(names.variables(field), " or "))
		}
		connection.Values[field.Name] = value
	}
	if _, err := entry.build(connection, nil); err != nil {
		return Connection{}, fmt.Errorf("connection %q is not usable: %w (variables: %s)", alias, err, names.all(entry.info))
	}
	return connection, nil
}
