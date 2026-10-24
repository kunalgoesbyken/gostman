package mcpclient

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/kunalgoesbyken/gostman/mcp"
)

const probeTimeout = 10 * time.Second

var legacyVersions = []string{"2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"}

type legacyFallback struct {
	version string
	restart bool
}

func (legacyFallback) Error() string {
	return "the server speaks an MCP version with an initialize handshake"
}

var legacyServers sync.Map

func (s *session) connect(ctx context.Context) error {
	if version, known := legacyServers.Load(s.address); known {
		err := s.initialize(ctx, version.(string))
		if err == nil || ctx.Err() != nil || isAuthRejection(err) {
			return err
		}
		legacyServers.Delete(s.address)
		if err := s.restartCommand(ctx); err != nil {
			return err
		}
	}
	err := s.discover(ctx)
	var legacy legacyFallback
	if !errors.As(err, &legacy) {
		return err
	}
	if legacy.restart {
		if err := s.relink(ctx); err != nil {
			return err
		}
	}
	if err := s.initialize(ctx, legacy.version); err != nil {
		return err
	}
	legacyServers.Store(s.address, legacy.version)
	return nil
}

func isAuthRejection(err error) bool {
	var rejected *rejection
	return errors.As(err, &rejected) && !fallsBack(rejected.code) && rejected.code < http.StatusInternalServerError
}

func (s *session) restartCommand(ctx context.Context) error {
	if s.reopen == nil {
		return nil
	}
	return s.relink(ctx)
}

func (s *session) relink(ctx context.Context) error {
	if s.reopen == nil {
		return protocolError("the server stopped before it answered")
	}
	s.link.close()
	restarted, err := s.reopen(ctx)
	if err != nil {
		return err
	}
	s.link = restarted
	return nil
}

func (s *session) probeContext(ctx context.Context) (context.Context, context.CancelFunc) {
	if s.reopen == nil {
		return context.WithCancel(ctx)
	}
	return context.WithTimeout(ctx, probeTimeout)
}

func (s *session) discover(ctx context.Context) error {
	s.modern, s.version = true, ModernVersion
	s.link.established("", ModernVersion)
	probe, cancel := s.probeContext(ctx)
	defer cancel()
	received, err := s.request(probe, MethodDiscover, nil)
	if err != nil {
		return s.probeFailed(ctx, probe, err)
	}
	var result discoverResult
	if err := json.Unmarshal(received.result, &result); err != nil {
		return protocolError("the server/discover result cannot be read: %v", err)
	}
	if !slices.Contains(result.SupportedVersions, ModernVersion) {
		return fallBack(result.SupportedVersions)
	}
	s.server = welcome{ProtocolVersion: ModernVersion, Server: result.Meta.Server, Instructions: result.Instructions, Capabilities: result.Capabilities}
	return nil
}

func (s *session) probeFailed(ctx, probe context.Context, err error) error {
	if ctx.Err() != nil {
		return err
	}
	if errors.Is(probe.Err(), context.DeadlineExceeded) {
		return legacyFallback{}
	}
	if command, ok := s.link.(*commandLink); ok && command.exited() {
		return legacyFallback{restart: true}
	}
	var refused *refusal
	if errors.As(err, &refused) {
		return modernOrLegacy(refused.reason, err)
	}
	var rejected *rejection
	if errors.As(err, &rejected) && fallsBack(rejected.code) {
		var body refusalBody
		if json.Unmarshal([]byte(rejected.body), &body) != nil {
			return legacyFallback{}
		}
		return modernOrLegacy(body.Error, err)
	}
	return err
}

func fallsBack(code int) bool {
	return code >= http.StatusBadRequest && code < http.StatusInternalServerError &&
		code != http.StatusUnauthorized && code != http.StatusForbidden && code != http.StatusProxyAuthRequired
}

func modernOrLegacy(reason mcp.Failure, err error) error {
	if reason.Code == codeUnsupportedVersion {
		var refused versionRefusal
		json.Unmarshal(reason.Data, &refused)
		return fallBack(refused.Supported)
	}
	if isModernCode(reason.Code) {
		return err
	}
	return legacyFallback{}
}

func fallBack(supported []string) error {
	if len(supported) == 0 {
		return legacyFallback{}
	}
	for _, version := range legacyVersions {
		if slices.Contains(supported, version) {
			return legacyFallback{version: version}
		}
	}
	return protocolError(
		"the server supports MCP %s, and Gostman speaks %s",
		strings.Join(supported, ", "), strings.Join(append([]string{ModernVersion}, legacyVersions...), ", "),
	)
}

func (s *session) initialize(ctx context.Context, version string) error {
	if version == "" {
		version = legacyVersions[0]
	}
	s.modern, s.version = false, version
	s.link.established("", "")
	received, err := s.request(ctx, mcp.MethodInitialize, greeting{
		InitializeParams: mcp.InitializeParams{ProtocolVersion: version},
		ClientInfo:       clientInfo(),
	})
	if err != nil {
		return err
	}
	if err := json.Unmarshal(received.result, &s.server); err != nil {
		return protocolError("the initialize result cannot be read: %v", err)
	}
	s.version = s.server.ProtocolVersion
	s.link.established(received.header.Get(headerSession), s.server.ProtocolVersion)
	return s.notify(ctx, mcp.MethodInitialized)
}
