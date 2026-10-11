package workspace

import (
	"github.com/krockxz/gostman/engine"
	"gopkg.in/yaml.v3"
)

const (
	emptyObject  = "{}"
	emptyList    = "[]"
	defaultGrant = "client_credentials"
)

var (
	requestKeys = []string{
		"id", "name", "order", "method", "url", "queryParams", "headers", "auth", "bodyType", "body",
		"graphqlQuery", "graphqlVariables", "grpcMethod", "grpcMessage", "grpcProtos", "options",
		"extractors", "assertions", "preScript", "postScript", "timestamp",
	}
	authKeys   = []string{"type", "username", "password", "token", "key", "value", "in", "oauth2"}
	oauth2Keys = []string{
		"grant", "authUrl", "tokenUrl", "clientId", "clientSecret", "scope", "username", "password",
		"callbackUrl", "credentialsIn", "pkce", "headerPrefix", "accessToken", "refreshToken", "expiresAt",
	}
	optionKeys = []string{"timeoutMs", "noFollowRedirects", "insecureTLS"}
)

type requestExtras struct {
	request []*yaml.Node
	auth    []*yaml.Node
	oauth2  []*yaml.Node
	options []*yaml.Node
}

type requestDocument struct {
	request Request
	order   int64
	extras  requestExtras
}

type requestContent struct {
	request Request
	order   int64
}

func isRowBody(bodyType string) bool {
	return bodyType == engine.BodyForm || bodyType == engine.BodyMultipart
}

func isEmptyPairs(text string) bool {
	return text == "" || text == emptyObject || text == emptyList
}

func (b nodeBuilder) pairs(text string) *yaml.Node {
	if isEmptyPairs(text) {
		return nil
	}
	return b.rows(text)
}

func (b nodeBuilder) body(request Request) *yaml.Node {
	switch {
	case isRowBody(request.BodyType):
		return b.rows(request.Body)
	case request.BodyType == engine.BodyBinary:
		return b.jsonText(request.Body)
	}
	return b.text(request.Body)
}

func (b nodeBuilder) graphqlVariables(text string) *yaml.Node {
	if text == emptyObject {
		return nil
	}
	return b.text(text)
}

func (b nodeBuilder) oauth2(config engine.OAuth2, extras []*yaml.Node) *yaml.Node {
	node := mappingNode()
	if config.Grant != defaultGrant {
		setField(node, "grant", b.explicitText(config.Grant))
	}
	setField(node, "authUrl", b.text(config.AuthURL))
	setField(node, "tokenUrl", b.text(config.TokenURL))
	setField(node, "clientId", b.text(config.ClientID))
	setField(node, "clientSecret", b.text(config.ClientSecret))
	setField(node, "scope", b.text(config.Scope))
	setField(node, "username", b.text(config.Username))
	setField(node, "password", b.text(config.Password))
	setField(node, "callbackUrl", b.text(config.CallbackURL))
	setField(node, "credentialsIn", b.text(config.CredentialsIn))
	if !config.PKCE {
		setField(node, "pkce", flagNode(false))
	}
	setField(node, "headerPrefix", b.text(config.HeaderPrefix))
	node.Content = append(node.Content, extras...)
	return filledMapping(node)
}

func (b nodeBuilder) auth(auth engine.Auth, extras requestExtras) *yaml.Node {
	node := mappingNode()
	setField(node, "type", b.text(auth.Type))
	setField(node, "username", b.text(auth.Username))
	setField(node, "password", b.text(auth.Password))
	setField(node, "token", b.text(auth.Token))
	setField(node, "key", b.text(auth.Key))
	setField(node, "value", b.text(auth.Value))
	setField(node, "in", b.text(auth.In))
	setField(node, "oauth2", b.oauth2(auth.OAuth2, extras.oauth2))
	node.Content = append(node.Content, extras.auth...)
	return filledMapping(node)
}

func (b nodeBuilder) options(options engine.Options, extras []*yaml.Node) *yaml.Node {
	node := mappingNode()
	setField(node, "timeoutMs", integerNode(int64(options.TimeoutMs)))
	setField(node, "noFollowRedirects", setFlagNode(options.NoFollowRedirects))
	setField(node, "insecureTLS", setFlagNode(options.InsecureTLS))
	node.Content = append(node.Content, extras...)
	return filledMapping(node)
}

func (b nodeBuilder) request(document requestDocument) *yaml.Node {
	request := document.request
	root := mappingNode()
	setField(root, "id", b.text(request.Id))
	setField(root, "name", b.text(request.Name))
	setField(root, "order", integerNode(document.order))
	setField(root, "method", b.text(request.Method))
	setField(root, "url", b.text(request.URL))
	setField(root, "queryParams", b.pairs(request.QueryParams))
	setField(root, "headers", b.pairs(request.Headers))
	setField(root, "auth", b.auth(request.Auth, document.extras))
	setField(root, "bodyType", b.text(request.BodyType))
	setField(root, "body", b.body(request))
	setField(root, "graphqlQuery", b.text(request.GraphqlQuery))
	setField(root, "graphqlVariables", b.graphqlVariables(request.GraphqlVariables))
	setField(root, "grpcMethod", b.text(request.GrpcMethod))
	setField(root, "grpcMessage", b.text(request.GrpcMessage))
	setField(root, "grpcProtos", b.jsonText(request.GrpcProtos))
	setField(root, "options", b.options(request.Options, document.extras.options))
	setField(root, "extractors", b.rows(request.Extractors))
	setField(root, "assertions", b.rows(request.Assertions))
	setField(root, "preScript", b.text(request.PreScript))
	setField(root, "postScript", b.text(request.PostScript))
	setField(root, "timestamp", b.text(request.Timestamp))
	root.Content = append(root.Content, document.extras.request...)
	return root
}

func (r *fieldReader) pairs(key string) string {
	if !r.has(key) {
		return emptyObject
	}
	return r.jsonText(key, false, withEnabledDefaults)
}

func (r *fieldReader) body(bodyType string) string {
	if isRowBody(bodyType) {
		return r.jsonText("body", false, withEnabledDefaults)
	}
	return r.jsonText("body", false, unchanged)
}

func (r *fieldReader) graphqlVariables() string {
	if !r.has("graphqlVariables") {
		return emptyObject
	}
	return r.text("graphqlVariables")
}

func readOAuth2(node *yaml.Node, failure *error) (engine.OAuth2, []*yaml.Node) {
	fields := readFields(node, oauth2Keys, failure)
	config := engine.OAuth2{
		Grant:         defaultGrant,
		AuthURL:       fields.text("authUrl"),
		TokenURL:      fields.text("tokenUrl"),
		ClientID:      fields.text("clientId"),
		ClientSecret:  fields.text("clientSecret"),
		Scope:         fields.text("scope"),
		Username:      fields.text("username"),
		Password:      fields.text("password"),
		CallbackURL:   fields.text("callbackUrl"),
		CredentialsIn: fields.text("credentialsIn"),
		PKCE:          fields.flag("pkce", true),
		HeaderPrefix:  fields.text("headerPrefix"),
	}
	if fields.has("grant") {
		config.Grant = fields.text("grant")
	}
	return config, fields.extras
}

func readAuth(node *yaml.Node, extras *requestExtras, failure *error) engine.Auth {
	fields := readFields(node, authKeys, failure)
	extras.auth = fields.extras
	auth := engine.Auth{
		Type:     fields.text("type"),
		Username: fields.text("username"),
		Password: fields.text("password"),
		Token:    fields.text("token"),
		Key:      fields.text("key"),
		Value:    fields.text("value"),
		In:       fields.text("in"),
	}
	auth.OAuth2, extras.oauth2 = readOAuth2(fields.fields["oauth2"], failure)
	return auth
}

func readOptions(node *yaml.Node, extras *requestExtras, failure *error) engine.Options {
	fields := readFields(node, optionKeys, failure)
	extras.options = fields.extras
	return engine.Options{
		TimeoutMs:         int(fields.integer("timeoutMs")),
		NoFollowRedirects: fields.flag("noFollowRedirects", false),
		InsecureTLS:       fields.flag("insecureTLS", false),
	}
}

func readRequest(root *yaml.Node) (requestDocument, error) {
	var failure error
	fields := readFields(root, requestKeys, &failure)
	document := requestDocument{order: fields.integer("order")}
	document.extras.request = fields.extras
	bodyType := fields.text("bodyType")
	document.request = Request{
		Id:               fields.text("id"),
		Name:             fields.text("name"),
		URL:              fields.text("url"),
		Method:           fields.text("method"),
		Headers:          fields.pairs("headers"),
		Body:             fields.body(bodyType),
		BodyType:         bodyType,
		QueryParams:      fields.pairs("queryParams"),
		GraphqlQuery:     fields.text("graphqlQuery"),
		GraphqlVariables: fields.graphqlVariables(),
		Auth:             readAuth(fields.fields["auth"], &document.extras, &failure),
		Options:          readOptions(fields.fields["options"], &document.extras, &failure),
		Extractors:       fields.jsonText("extractors", false, withEnabledDefaults),
		Assertions:       fields.jsonText("assertions", false, withEnabledDefaults),
		PreScript:        fields.text("preScript"),
		PostScript:       fields.text("postScript"),
		GrpcMethod:       fields.text("grpcMethod"),
		GrpcMessage:      fields.text("grpcMessage"),
		GrpcProtos:       fields.jsonText("grpcProtos", false, unchanged),
		Timestamp:        fields.text("timestamp"),
	}
	return document, failure
}

func readRequestContent(root *yaml.Node) (requestContent, error) {
	document, err := readRequest(root)
	return requestContent{request: document.request, order: document.order}, err
}

func normalizeRequest(document requestDocument) (Request, error) {
	content, err := readRequestContent(nodeBuilder{}.request(document))
	return content.request, err
}

func encodeRequest(document requestDocument) ([]byte, error) {
	build := func(builder nodeBuilder) *yaml.Node { return builder.request(document) }
	return encodeVerified(build, readRequestContent)
}
