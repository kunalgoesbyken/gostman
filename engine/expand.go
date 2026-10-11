package engine

import (
	"fmt"
	"net/url"
)

type Expansion struct {
	substitution *substitution
}

func NewExpansion(variables string) (*Expansion, error) {
	parsed, err := parseVariables(variables)
	if err != nil {
		return nil, fmt.Errorf("environment variables are not valid JSON: %w", err)
	}
	return &Expansion{&substitution{variables: parsed, budget: maxEncodedBody}}, nil
}

func (e *Expansion) Text(input string) string {
	return e.substitution.apply(input)
}

func (e *Expansion) Headers(raw string, auth Auth) ([]HeaderEntry, error) {
	pairs, err := parsePairs(raw)
	if err != nil {
		return nil, fmt.Errorf("headers are not valid: %w", err)
	}
	pairs = applyAuth(auth, e.Text, substitutePairs(pairs, e.Text), &url.URL{})

	entries := make([]HeaderEntry, 0, len(pairs))
	for _, header := range pairs {
		entries = append(entries, HeaderEntry{Key: header.key, Value: header.value})
	}
	return entries, nil
}

func (e *Expansion) Err() error {
	if e.substitution.exceeded {
		return fmt.Errorf("the request is larger than 10 MB once variables are filled in")
	}
	return nil
}
