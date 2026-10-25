package runner

import (
	"context"
	"errors"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	authOAuth2   = "oauth2"
	expiryMargin = 30 * time.Second
	SignInNeeded = "This request uses an OAuth 2 grant that needs a sign-in in a browser. " +
		"Pass a token with --oauth-token-env or --oauth-refresh-token-env, or use the client credentials or password grant."
)

type tokenCache map[engine.OAuth2]engine.OAuth2

func identityOf(config engine.OAuth2) engine.OAuth2 {
	config = config.WithoutTokens()
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
	config.IDToken = cached.IDToken
	config.ExpiresAt = cached.ExpiresAt
	return config
}

func needsSignIn(config engine.OAuth2) bool {
	return config.Grant == engine.GrantAuthorizationCode || config.Grant == engine.GrantDeviceCode
}

func seeded(config engine.OAuth2, given engine.Token) engine.OAuth2 {
	if !needsSignIn(config) || config.AccessToken != "" || config.RefreshToken != "" {
		return config
	}
	config.AccessToken = given.AccessToken
	config.RefreshToken = given.RefreshToken
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
		Variables: s.known().text(),
		Options:   options,
		Refresh:   refresh,
	}, s.policy)
	if token.Error != "" {
		return config, errors.New(token.Error)
	}
	config.AccessToken = token.AccessToken
	config.RefreshToken = token.RefreshToken
	config.IDToken = token.IDToken
	config.ExpiresAt = token.ExpiresAt
	return config, nil
}

func (s *session) renewToken(ctx context.Context, config engine.OAuth2, options engine.Options) (engine.OAuth2, error) {
	browserOnly := needsSignIn(config)
	if config.RefreshToken != "" {
		renewed, err := s.exchange(ctx, config, options, true)
		if err == nil {
			return renewed, nil
		}
		if browserOnly {
			return config, err
		}
	}
	if browserOnly {
		return config, errors.New(SignInNeeded)
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
	config := seeded(s.common.recall(request.Auth.OAuth2), s.common.signIn)
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
