package workspace

import (
	"github.com/krockxz/gostman/engine"
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
