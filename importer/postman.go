package importer

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	postmanGlobals    = "globals"
	postmanSecretType = "secret"
	listenPreRequest  = "prerequest"
	listenTest        = "test"
	globalsSuffix     = " (globals)"
)

func (c *collector) readPostmanCollection(doc document) {
	root := object(doc.data)
	info := object(root["info"])
	name := cleanName(text(info["name"]), strings.TrimSuffix(doc.file.Name, ".json"))
	c.read(name, FormatPostman, func() {
		rootID := c.addFolder(name, "")
		for key, value := range variableMap(objects(root["variable"]), "key", "value") {
			if _, taken := c.Variables[key]; !taken {
				c.Variables[key] = value
			}
		}
		base := c.postmanScope(root, fmt.Sprintf(labelCollection, name))
		c.postmanItems(list(root["item"]), rootID, base, 0)
		c.summarizeScripts(postmanDialect, name)
	})
}

func (c *collector) postmanScope(node map[string]any, label string) scope {
	var inherited scope
	if auth, set := c.postmanAuth(object(node["auth"])); set {
		inherited.auth = &auth
	}
	inherited.pre = nonEmpty(c.postmanScript(label, node, listenPreRequest))
	inherited.post = nonEmpty(c.postmanScript(label, node, listenTest))
	for _, entry := range objects(node["variable"]) {
		if key := text(entry["key"]); key != "" && !flag(entry["disabled"]) {
			inherited.vars = append(inherited.vars, row{Key: key, Value: text(entry["value"]), Enabled: true})
		}
	}
	return inherited
}

func nonEmpty(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return []string{value}
}

func (c *collector) postmanItems(items []any, folderID string, inherited scope, depth int) {
	if depth >= maxFolderDepth {
		c.Warnings = append(c.Warnings, fmt.Sprintf(messageDepth, maxFolderDepth))
		return
	}
	for _, entry := range items {
		item := object(entry)
		switch {
		case item == nil:
		case item["item"] != nil:
			id := c.addFolder(text(item["name"]), folderID)
			c.postmanItems(list(item["item"]), id, inherited.within(c.postmanScope(item, fmt.Sprintf(labelFolder, text(item["name"])))), depth+1)
		case item["request"] != nil:
			c.postmanRequest(item, folderID, inherited)
		}
	}
}

func (c *collector) postmanRequest(item map[string]any, folderID string, inherited scope) {
	label := fmt.Sprintf(labelRequest, text(item["name"]))
	source := object(item["request"])
	if source == nil {
		source = map[string]any{"url": item["request"], "method": "GET"}
	}
	headers := postmanRows(source["header"])
	request := parts{
		name:        text(item["name"]),
		method:      text(source["method"]),
		description: postmanDescription(source["description"]),
		headers:     headers,
		preScript:   c.postmanScript(label, item, listenPreRequest),
		postScript:  c.postmanScript(label, item, listenTest),
		options:     postmanOptions(object(item["protocolProfileBehavior"])),
	}
	request.url, request.params = postmanURL(source["url"])
	if auth, set := c.postmanAuth(object(source["auth"])); set {
		request.auth = &auth
	}
	c.postmanBody(object(source["body"]), &request)
	c.build(request, inherited, folderID)
}

func postmanDescription(value any) string {
	if described := object(value); described != nil {
		return text(described["content"])
	}
	return text(value)
}

func postmanOptions(behavior map[string]any) engine.Options {
	following, set := behavior["followRedirects"].(bool)
	return engine.Options{NoFollowRedirects: set && !following}
}

func postmanRows(value any) []row {
	if raw, isText := value.(string); isText {
		return headerLines(raw)
	}
	var rows []row
	for _, entry := range objects(value) {
		rows = append(rows, row{Key: text(entry["key"]), Value: text(entry["value"]), Enabled: !flag(entry["disabled"])})
	}
	return keyedRows(rows)
}

func headerLines(raw string) []row {
	var rows []row
	for _, line := range strings.Split(normalizeNewlines(raw), "\n") {
		if key, value, found := strings.Cut(line, ":"); found {
			rows = append(rows, row{Key: strings.TrimSpace(key), Value: strings.TrimSpace(value), Enabled: true})
		}
	}
	return keyedRows(rows)
}

func postmanURL(value any) (string, []row) {
	source := object(value)
	if source == nil {
		return text(value), nil
	}
	raw := text(source["raw"])
	if raw == "" {
		raw = composePostmanURL(source)
	}
	query := postmanRows(source["query"])
	if source["query"] != nil {
		raw, _, _ = strings.Cut(raw, "?")
	}
	return applyPathParams(raw, variableRows(source["variable"])), query
}

func variableRows(value any) []row {
	var rows []row
	for _, entry := range objects(value) {
		rows = append(rows, row{Key: text(entry["key"]), Value: text(entry["value"]), Enabled: true})
	}
	return rows
}

func composePostmanURL(source map[string]any) string {
	host := joinParts(source["host"], ".")
	if host == "" {
		return ""
	}
	address := host
	if protocol := strings.TrimSuffix(text(source["protocol"]), "://"); protocol != "" {
		address = protocol + "://" + host
	}
	if port := text(source["port"]); port != "" {
		address += ":" + port
	}
	if segments := joinParts(source["path"], "/"); segments != "" {
		address += "/" + strings.TrimPrefix(segments, "/")
	}
	return address
}

func joinParts(value any, separator string) string {
	items := list(value)
	if items == nil {
		return text(value)
	}
	parts := make([]string, len(items))
	for index, item := range items {
		if described := object(item); described != nil {
			parts[index] = text(described["value"])
		} else {
			parts[index] = text(item)
		}
	}
	return strings.Join(parts, separator)
}

func (c *collector) postmanScript(label string, node map[string]any, listen string) string {
	var scripts []string
	for _, event := range objects(node["event"]) {
		if text(event["listen"]) != listen {
			continue
		}
		script := object(event["script"])
		if lines := list(script["exec"]); lines != nil {
			scripts = append(scripts, c.translateScript(postmanDialect, label, stageName(listen), joinLines(lines)))
		} else if code := text(script["exec"]); code != "" {
			scripts = append(scripts, c.translateScript(postmanDialect, label, stageName(listen), code))
		}
	}
	return joinScripts(scripts)
}

func joinLines(lines []any) string {
	texts := make([]string, len(lines))
	for index, line := range lines {
		texts[index] = text(line)
	}
	return strings.Join(texts, "\n")
}

func (c *collector) postmanBody(body map[string]any, request *parts) {
	if body == nil || flag(body["disabled"]) {
		return
	}
	switch text(body["mode"]) {
	case "raw":
		request.body = text(body["raw"])
		language := text(object(object(body["options"])["raw"])["language"])
		request.bodyType = rawBodyType(language, request.body, request.headers)
	case "urlencoded":
		request.body, request.bodyType = rowsJSON(postmanRows(body["urlencoded"])), bodyForm
	case "formdata":
		rows := postmanFormRows(objects(body["formdata"]))
		request.body, request.bodyType = rowsJSON(rows), bodyMultipart
		request.needsFiles = anyFile(rows)
	case "file":
		request.bodyType, request.needsFiles = bodyBinary, true
	case "graphql":
		graphql := object(body["graphql"])
		request.method = methodGraphQL
		request.graphqlQuery = text(graphql["query"])
		request.graphqlVars = graphqlVariables(graphql["variables"])
	}
}

func graphqlVariables(value any) string {
	if raw, isText := value.(string); isText {
		return raw
	}
	if value == nil {
		return ""
	}
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return ""
	}
	return string(encoded)
}

func rawBodyType(language, body string, headers []row) string {
	switch strings.ToLower(language) {
	case "json":
		return bodyJSON
	case "xml":
		return bodyXML
	case "text", "html", "javascript":
		return bodyText
	}
	for _, header := range headers {
		if strings.EqualFold(header.Key, "content-type") {
			return bodyTypeOfMime(header.Value)
		}
	}
	if json.Valid([]byte(body)) {
		return bodyJSON
	}
	return bodyText
}

func postmanFormRows(entries []map[string]any) []row {
	var rows []row
	for _, entry := range entries {
		candidate := row{Key: text(entry["key"]), Enabled: !flag(entry["disabled"]), Type: rowTypeText, Value: text(entry["value"])}
		if text(entry["type"]) == rowTypeFile {
			candidate = row{Key: candidate.Key, Enabled: candidate.Enabled, Type: rowTypeFile, FileName: baseName(text(entry["src"])), ContentType: text(entry["contentType"])}
		}
		rows = append(rows, candidate)
	}
	return keyedRows(rows)
}

func anyFile(rows []row) bool {
	for _, candidate := range rows {
		if candidate.Type == rowTypeFile {
			return true
		}
	}
	return false
}

func baseName(location string) string {
	normalized := strings.ReplaceAll(location, `\`, "/")
	return normalized[strings.LastIndex(normalized, "/")+1:]
}

func postmanAuthFields(auth map[string]any, kind string) map[string]string {
	fields := map[string]string{}
	if entries := objects(auth[kind]); entries != nil {
		for _, entry := range entries {
			fields[text(entry["key"])] = text(entry["value"])
		}
		return fields
	}
	for key, value := range object(auth[kind]) {
		fields[key] = text(value)
	}
	return fields
}

func (c *collector) postmanAuth(auth map[string]any) (engine.Auth, bool) {
	kind := text(auth["type"])
	if kind == "" || kind == "inherit" {
		return engine.Auth{}, false
	}
	fields := postmanAuthFields(auth, kind)
	switch kind {
	case "noauth":
		return engine.Auth{}, true
	case authBasic, authDigest:
		return credentialsAuth(kind, fields["username"], fields["password"]), true
	case authBearer:
		return bearerAuth(fields["token"]), true
	case authNTLM:
		return ntlmAuth(fields["username"], fields["password"], fields["domain"]), true
	case authAPIKey:
		return apiKeyAuth(fields["key"], fields["value"], fields["in"] == inQuery), true
	case authAWS:
		return awsAuth(fields["accessKey"], fields["secretKey"], fields["sessionToken"], fields["region"], fields["service"]), true
	case authOAuth1:
		return postmanOAuth1(fields), true
	case authOAuth2:
		return c.postmanOAuth2(fields), true
	case authJWT:
		return postmanJWT(fields), true
	case authASAP:
		return asapAuth(engine.ASAPAuth{
			Algorithm: fields["alg"], Issuer: fields["iss"], Subject: fields["sub"], Audience: fields["aud"],
			KeyID: fields["kid"], PrivateKey: fields["privateKey"], Claims: fields["claims"], Expiry: fields["exp"],
		}), true
	case authHawk:
		return hawkAuth(engine.HawkAuth{
			ID: fields["authId"], Key: fields["authKey"], Algorithm: fields["algorithm"], Ext: fields["extraData"],
			App: fields["app"], Dlg: fields["delegation"], Nonce: fields["nonce"], Timestamp: fields["timestamp"],
		}, fields["includePayloadHash"] == "true"), true
	}
	c.Warnings = appendUnique(c.Warnings, fmt.Sprintf(messageAuthType, kind))
	return engine.Auth{}, true
}

func postmanJWT(fields map[string]string) engine.Auth {
	config := engine.JWTAuth{
		Algorithm: fields["algorithm"], Secret: fields["secret"], PrivateKey: fields["privateKey"], Payload: fields["payload"],
		Header: fields["header"], Prefix: fields["headerPrefix"], QueryKey: fields["queryParamKey"],
	}
	if fields["isSecretBase64Encoded"] == "true" {
		config.SecretEncoding = jwtSecretBase64
	}
	if fields["addTokenTo"] == "queryParam" {
		config.In = inQuery
	}
	return engine.Auth{Type: authJWT, JWT: config}
}

func postmanOAuth1(fields map[string]string) engine.Auth {
	return engine.Auth{Type: authOAuth1, OAuth1: engine.OAuth1Auth{
		ConsumerKey: fields["consumerKey"], ConsumerSecret: fields["consumerSecret"], Token: fields["token"],
		TokenSecret: fields["tokenSecret"], SignatureMethod: fields["signatureMethod"], Realm: fields["realm"],
		Callback: fields["callback"], Verifier: fields["verifier"], Nonce: fields["nonce"], Timestamp: fields["timestamp"],
	}}
}

func (c *collector) postmanOAuth2(fields map[string]string) engine.Auth {
	auth, ok := oauth2Auth(oauth2Fields{
		Grant: postmanGrant(fields["grant_type"]), AuthURL: fields["authUrl"], TokenURL: fields["accessTokenUrl"],
		ClientID: fields["clientId"], ClientSecret: fields["clientSecret"], Scope: fields["scope"],
		Username: fields["username"], Password: fields["password"], CallbackURL: fields["redirect_uri"],
		PKCE: fields["grant_type"] == "authorization_code_with_pkce", SecretInBody: fields["client_authentication"] == "body",
	})
	if !ok {
		c.Warnings = appendUnique(c.Warnings, fmt.Sprintf(messageAuthType, authOAuth2+" "+fields["grant_type"]))
		return engine.Auth{}
	}
	return auth
}

func postmanGrant(grant string) string {
	switch grant {
	case "authorization_code_with_pkce":
		return grantAuthorizationCode
	case "password_credentials":
		return grantPassword
	}
	return grant
}

func appendUnique(items []string, item string) []string {
	for _, existing := range items {
		if existing == item {
			return items
		}
	}
	return append(items, item)
}

func (c *collector) readPostmanEnvironment(doc document) {
	root := object(doc.data)
	name := cleanName(text(root["name"]), strings.TrimSuffix(doc.file.Name, ".json"))
	if text(root["_postman_variable_scope"]) == postmanGlobals {
		name += globalsSuffix
	}
	c.read(name, FormatPostman, func() {
		values := map[string]string{}
		secrets := map[string]map[string]bool{}
		var secretNames []string
		for _, entry := range objects(root["values"]) {
			key := text(entry["key"])
			if key == "" || entry["enabled"] == false {
				continue
			}
			values[key] = text(entry["value"])
			if text(entry["type"]) == postmanSecretType {
				secrets[key] = map[string]bool{"secret": true}
				secretNames = append(secretNames, key)
			}
		}
		id := c.addEnvironment(name, values)
		c.markSecrets(id, name, secrets, secretNames)
	})
}

func (c *collector) markSecrets(id, name string, secrets map[string]map[string]bool, names []string) {
	if len(names) == 0 {
		return
	}
	encoded, err := json.Marshal(secrets)
	if err != nil {
		return
	}
	for index := range c.Environments {
		if c.Environments[index].Id == id {
			c.Environments[index].Meta = string(encoded)
		}
	}
	c.Warnings = append(c.Warnings, fmt.Sprintf(messageSecretVariables, name, listNames(names)))
}
