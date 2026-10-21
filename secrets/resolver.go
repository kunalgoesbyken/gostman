package secrets

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

type Provider interface {
	Resolve(ctx context.Context, ref Ref) (string, error)
}

type Lookup func(alias string) (Connection, error)

type Resolver struct {
	lookup  Lookup
	gateway *gateway
	cache   *cache
}

func NewResolver(lookup Lookup) *Resolver {
	return &Resolver{lookup: lookup, gateway: newGateway(), cache: newCache()}
}

func (r *Resolver) Resolve(ctx context.Context, ref Ref) (string, error) {
	if err := ref.Validate(); err != nil {
		return "", err
	}
	connection, err := r.lookup(ref.Provider)
	if err != nil {
		return "", err
	}
	key := strings.Join([]string{connection.fingerprint(), ref.Path, ref.Field, ref.Version}, "\x00")
	if value, found := r.cache.get(key); found {
		return value, nil
	}
	value, err := r.fetch(ctx, connection, ref)
	if err != nil {
		return "", fmt.Errorf("secret %s: %w", ref.Describe(), err)
	}
	r.cache.put(key, value)
	return value, nil
}

func (r *Resolver) fetch(ctx context.Context, connection Connection, ref Ref) (string, error) {
	entry, found := kindNamed(connection.Kind)
	if !found {
		return "", fmt.Errorf("the connection %q has the unknown kind %q", connection.Alias, connection.Kind)
	}
	provider, err := entry.build(connection, r.gateway)
	if err != nil {
		return "", fmt.Errorf("connection %q is not usable: %w", connection.Alias, err)
	}
	payload, err := provider.Resolve(ctx, ref)
	if err != nil {
		return "", err
	}
	value, err := pick(payload, ref.Field)
	if err != nil {
		return "", err
	}
	return value, checkValue(value)
}

func checkValue(value string) error {
	switch {
	case value == "":
		return errors.New("the secret is empty")
	case len(value) > maxValueBytes:
		return fmt.Errorf("the secret is larger than %d bytes", maxValueBytes)
	}
	return nil
}

func pick(payload, field string) (string, error) {
	if field == "" {
		return payload, nil
	}
	decoder := json.NewDecoder(bytes.NewReader([]byte(payload)))
	decoder.UseNumber()
	var fields map[string]any
	if err := decoder.Decode(&fields); err != nil || fields == nil {
		return "", fmt.Errorf("the secret is not a JSON object, so field %q cannot be read", field)
	}
	selected, found := fields[field]
	if !found {
		return "", fmt.Errorf("field %q is not in the secret; it has %s", field, strings.Join(fieldNames(fields), ", "))
	}
	switch typed := selected.(type) {
	case string:
		return typed, nil
	case json.Number:
		return typed.String(), nil
	case bool:
		return fmt.Sprint(typed), nil
	}
	return "", fmt.Errorf("field %q is not text, a number or a boolean", field)
}

func fieldNames(fields map[string]any) []string {
	names := make([]string, 0, len(fields))
	for name := range fields {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
