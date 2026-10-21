package runner

import (
	"context"
	"errors"
	"time"

	"github.com/krockxz/gostman/engine"
)

const (
	authOAuth2   = "oauth2"
	expiryMargin = 30 * time.Second
	signInNeeded = "This request uses the OAuth 2 authorization code grant, which needs a sign-in in a browser. " +
		"Use the client credentials or password grant, or put a valid token in the request's auth.oauth2.accessToken."
)

type tokenCache map[engine.OAuth2]engine.OAuth2

func identityOf(config engine.OAuth2) engine.OAuth2 {
	config.AccessToken = ""
	config.RefreshToken = ""
	config.ExpiresAt = 0
	config.HeaderPrefix = ""
	return config
}

func (c tokenCache) recall(config engine.OAuth2) engine.OAuth2 {
	cached, ok := c[identityOf(config)]
	if !ok {
		return config
	}
	config.AccessToken = cached.AccessToken
	config.RefreshToken = cached.RefreshToken
	config.ExpiresAt = cached.ExpiresAt
	return config
}

func (c tokenCache) remember(config engine.OAuth2) {
	c[identityOf(config)] = config
}

func isTokenFresh(config engine.OAuth2, now time.Time) bool {
	if config.AccessToken == "" {
		return false
	}
	return config.ExpiresAt == 0 || config.ExpiresAt-expiryMargin.Milliseconds() > now.UnixMilli()
}

func (s *session) exchange(ctx context.Context, config engine.OAuth2, options engine.Options, refresh bool) (engine.OAuth2, error) {
	token := engine.FetchToken(ctx, engine.TokenExchange{
		Config:    config,
		Variables: s.variables.text(),
		Options:   options,
		Refresh:   refresh,
	}, s.policy)
	if token.Error != "" {
		return config, errors.New(token.Error)
	}
	config.AccessToken = token.AccessToken
	config.RefreshToken = token.RefreshToken
	config.ExpiresAt = token.ExpiresAt
	return config, nil
}

func (s *session) renewToken(ctx context.Context, config engine.OAuth2, options engine.Options) (engine.OAuth2, error) {
	needsSignIn := config.Grant == engine.GrantAuthorizationCode
	if config.RefreshToken != "" {
		renewed, err := s.exchange(ctx, config, options, true)
		if err == nil {
			return renewed, nil
		}
		if needsSignIn {
			return config, err
		}
	}
	if needsSignIn {
		return config, errors.New(signInNeeded)
	}
	return s.exchange(ctx, config, options, false)
}

func (s *session) withFreshToken(ctx context.Context, request Request) (Request, error) {
	effective := engine.InheritedAuth(request.Auth, request.layers())
	if effective.Type != authOAuth2 {
		return request, nil
	}
	request.Auth = effective
	s.common.signInMu.Lock()
	defer s.common.signInMu.Unlock()
	config := s.common.recall(request.Auth.OAuth2)
	if !isTokenFresh(config, time.Now()) {
		renewed, err := s.renewToken(ctx, config, request.Options)
		if err != nil {
			return request, err
		}
		config = renewed
		s.common.remember(config)
	}
	request.Auth.OAuth2 = config
	return request, nil
}
