package workspace

import (
	"github.com/kunalgoesbyken/gostman/engine"
	"gopkg.in/yaml.v3"
)

type textField struct {
	key   string
	value *string
}

func awsFields(config *engine.AWSAuth) []textField {
	return []textField{
		{"accessKey", &config.AccessKey},
		{"secretKey", &config.SecretKey},
		{"sessionToken", &config.SessionToken},
		{"region", &config.Region},
		{"service", &config.Service},
	}
}

func oauth1Fields(config *engine.OAuth1Auth) []textField {
	return []textField{
		{"consumerKey", &config.ConsumerKey},
		{"consumerSecret", &config.ConsumerSecret},
		{"token", &config.Token},
		{"tokenSecret", &config.TokenSecret},
		{"signatureMethod", &config.SignatureMethod},
		{"privateKey", &config.PrivateKey},
		{"realm", &config.Realm},
		{"callback", &config.Callback},
		{"verifier", &config.Verifier},
		{"nonce", &config.Nonce},
		{"timestamp", &config.Timestamp},
		{"in", &config.In},
	}
}

func edgeGridFields(config *engine.EdgeGridAuth) []textField {
	return []textField{
		{"clientToken", &config.ClientToken},
		{"clientSecret", &config.ClientSecret},
		{"accessToken", &config.AccessToken},
		{"nonce", &config.Nonce},
		{"timestamp", &config.Timestamp},
		{"headersToSign", &config.HeadersToSign},
		{"maxBody", &config.MaxBody},
	}
}

func jwtFields(config *engine.JWTAuth) []textField {
	return []textField{
		{"algorithm", &config.Algorithm},
		{"secret", &config.Secret},
		{"secretEncoding", &config.SecretEncoding},
		{"privateKey", &config.PrivateKey},
		{"payload", &config.Payload},
		{"header", &config.Header},
		{"in", &config.In},
		{"prefix", &config.Prefix},
		{"queryKey", &config.QueryKey},
	}
}

func asapFields(config *engine.ASAPAuth) []textField {
	return []textField{
		{"algorithm", &config.Algorithm},
		{"issuer", &config.Issuer},
		{"subject", &config.Subject},
		{"audience", &config.Audience},
		{"keyId", &config.KeyID},
		{"privateKey", &config.PrivateKey},
		{"claims", &config.Claims},
		{"expiry", &config.Expiry},
	}
}

func hawkFields(config *engine.HawkAuth) []textField {
	return []textField{
		{"id", &config.ID},
		{"key", &config.Key},
		{"algorithm", &config.Algorithm},
		{"ext", &config.Ext},
		{"app", &config.App},
		{"dlg", &config.Dlg},
		{"nonce", &config.Nonce},
		{"timestamp", &config.Timestamp},
		{"payloadHash", &config.PayloadHash},
	}
}

func (b nodeBuilder) section(fields []textField) *yaml.Node {
	node := mappingNode()
	for _, field := range fields {
		setField(node, field.key, b.text(*field.value))
	}
	return filledMapping(node)
}

func readSection(node *yaml.Node, fields []textField, failure *error) {
	keys := make([]string, len(fields))
	for i, field := range fields {
		keys[i] = field.key
	}
	reader := readFields(node, keys, failure)
	for _, field := range fields {
		*field.value = reader.text(field.key)
	}
}
