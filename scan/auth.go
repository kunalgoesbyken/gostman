package scan

import "github.com/kunalgoesbyken/gostman/engine"

type authField struct {
	label string
	pick  func(engine.Auth) string
}

var authFields = []authField{
	{"auth.password", func(a engine.Auth) string { return a.Password }},
	{"auth.bearer", func(a engine.Auth) string { return a.Token }},
	{"auth.apiKey", func(a engine.Auth) string { return a.Value }},
	{"auth.oauth2.clientSecret", func(a engine.Auth) string { return a.OAuth2.ClientSecret }},
	{"auth.oauth2.password", func(a engine.Auth) string { return a.OAuth2.Password }},
	{"auth.oauth2.accessToken", func(a engine.Auth) string { return a.OAuth2.AccessToken }},
	{"auth.oauth2.refreshToken", func(a engine.Auth) string { return a.OAuth2.RefreshToken }},
	{"auth.aws.secretKey", func(a engine.Auth) string { return a.AWS.SecretKey }},
	{"auth.aws.sessionToken", func(a engine.Auth) string { return a.AWS.SessionToken }},
	{"auth.oauth1.consumerSecret", func(a engine.Auth) string { return a.OAuth1.ConsumerSecret }},
	{"auth.oauth1.token", func(a engine.Auth) string { return a.OAuth1.Token }},
	{"auth.oauth1.tokenSecret", func(a engine.Auth) string { return a.OAuth1.TokenSecret }},
	{"auth.oauth1.privateKey", func(a engine.Auth) string { return a.OAuth1.PrivateKey }},
	{"auth.edgegrid.clientSecret", func(a engine.Auth) string { return a.EdgeGrid.ClientSecret }},
	{"auth.edgegrid.accessToken", func(a engine.Auth) string { return a.EdgeGrid.AccessToken }},
	{"auth.jwt.secret", func(a engine.Auth) string { return a.JWT.Secret }},
	{"auth.jwt.privateKey", func(a engine.Auth) string { return a.JWT.PrivateKey }},
	{"auth.asap.privateKey", func(a engine.Auth) string { return a.ASAP.PrivateKey }},
	{"auth.hawk.key", func(a engine.Auth) string { return a.Hawk.Key }},
}

func (s *scanner) auth(at site, auth engine.Auth) {
	check := literal(literalRule)
	for _, field := range authFields {
		s.examine(at, field.label, field.pick(auth), check)
	}
}
