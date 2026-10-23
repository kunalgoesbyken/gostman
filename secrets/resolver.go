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

type entryProvider interface {
	Provider
	Volatile(ref Ref) bool
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
	provider, err := r.provider(connection)
	if err != nil {
		return "", err
	}
	entries, readsEntries := provider.(entryProvider)
	isCached := !readsEntries || !entries.Volatile(ref)
	key := strings.Join([]string{connection.fingerprint(), ref.Path, ref.Field, ref.Version}, "\x00")
	if value, found := r.cache.get(key); found && isCached {
		return value, nil
	}
	value, err := read(ctx, provider, ref, readsEntries)
	if err != nil {
		return "", fmt.Errorf("secret %s: %w", ref.Describe(), err)
	}
	if isCached {
		r.cache.put(key, value)
	}
	return value, nil
}

func (r *Resolver) provider(connection Connection) (Provider, error) {
	entry, found := kindNamed(connection.Kind)
	if !found {
		return nil, fmt.Errorf("the connection %q has the unknown kind %q", connection.Alias, connection.Kind)
	}
	provider, err := entry.build(connection, r.gateway)
	if err != nil {
		return nil, fmt.Errorf("connection %q is not usable: %w", connection.Alias, err)
	}
	return provider, nil
}

func read(ctx context.Context, provider Provider, ref Ref, readsEntries bool) (string, error) {
	payload, err := provider.Resolve(ctx, ref)
	if err != nil {
		return "", err
	}
	value := payload
	if !readsEntries {
		if value, err = pick(payload, ref.Field); err != nil {
			return "", err
		}
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
