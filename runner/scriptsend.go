package runner

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/loopback"
	"github.com/kunalgoesbyken/gostman/runner/sandbox"
)

func (s *session) learn(library []Request) error {
	s.library = library
	return s.scripts.Call("collectionHosts", &s.hosts, library, s.known().text())
}

func (s *session) scripted() *session {
	scoped := *s
	base := s.policy.Permit
	scoped.policy.Permit = func(host string) bool {
		if base != nil && !base(host) {
			return false
		}
		return loopback.IsHost(host) || slices.Contains(s.hosts, strings.ToLower(host))
	}
	return &scoped
}

func (s *session) sendFromScript(ctx context.Context, target string) (string, error) {
	var request Request
	if err := s.scripts.Call("scriptedRequest", &request, json.RawMessage(target), s.library); err != nil {
		return "", err
	}
	limits := s.scripts.Limits()
	if request.Options.TimeoutMs == 0 {
		request.Options.TimeoutMs = int(limits.SendTimeout.Milliseconds())
	}
	ctx, cancel := context.WithTimeout(ctx, limits.SendTimeout)
	defer cancel()
	response, err := s.scripted().transmit(ctx, request)
	if err != nil {
		return "", err
	}
	if response.Error != "" {
		return "", errors.New(response.Body)
	}
	described, err := s.subject("responseSubject", response)
	return string(described), err
}

func (s *session) bridge(ctx context.Context) sandbox.Bridge {
	sent := 0
	return func(target string) (string, error) {
		allowed := s.scripts.Limits().Sends
		if sent >= allowed {
			return "", fmt.Errorf("a script may call sendRequest %d times", allowed)
		}
		sent++
		return s.sendFromScript(ctx, target)
	}
}
