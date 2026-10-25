package importer

import (
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	postmanGlobals    = "globals"
	postmanSecretType = "secret"
	listenPreRequest  = "prerequest"
	listenTest        = "test"
	globalsName       = "Globals"
	behaviorRedirects = "followRedirects"
	behaviorStrictSSL = "strictSSL"
	behaviorPruning   = "disableBodyPruning"
	behaviorCookies   = "disableCookies"
)

var mappedBehaviors = setOf(behaviorRedirects, behaviorStrictSSL, behaviorPruning, behaviorCookies)

func (c *collector) readPostmanCollection(doc document) {
	root := object(doc.data)
	info := object(root["info"])
	name := cleanName(text(info["name"]), strings.TrimSuffix(doc.file.Name, ".json"))
	c.read(name, FormatPostman, func() {
		collection := c.postmanScope(root, labelCollection, name)
		collection.description = describedText(info["description"])
		rootID := c.addScopedFolder(name, "", c.collectionScope(collection))
		c.postmanItems(list(root["item"]), rootID, object(root["protocolProfileBehavior"]), 0)
		c.summarizeScripts(postmanDialect, name)
	})
}

func (c *collector) readPostmanDump(doc document) {
	root := object(doc.data)
	for index, entry := range list(root["collections"]) {
		if classifyStructured(entry) != kindPostmanCollection {
			c.skip(messagePostmanLegacy, doc.file.Name, legacyLabel(entry, index))
			continue
		}
		c.readPostmanCollection(document{file: doc.file, data: entry})
	}
	for _, entry := range list(root["environments"]) {
		c.readPostmanEnvironment(document{file: doc.file, data: entry})
	}
	if globals := list(root["globals"]); len(globals) > 0 {
		c.readPostmanEnvironment(document{file: doc.file, data: map[string]any{"name": globalsName, "values": globals, "_postman_variable_scope": postmanGlobals}})
	}
}

func legacyLabel(entry any, index int) string {
	if name := text(object(entry)["name"]); name != "" {
		return strconv.Quote(name)
	}
	return fmt.Sprintf(messageCollectionNumber, index+1)
}

func (c *collector) postmanScope(node map[string]any, kind, name string) scope {
	label := fmt.Sprintf(kind, name)
	var settings scope
	if auth, set := c.postmanAuth(object(node["auth"])); set {
		settings.auth = &auth
	}
	settings.pre = c.postmanScript(label, node, listenPreRequest)
	settings.post = c.postmanScript(label, node, listenTest)
	settings.description = describedText(node["description"])
	for _, entry := range objects(node["variable"]) {
		key := text(entry["key"])
		if strings.TrimSpace(key) == "" {
			continue
		}
		qualified := cleanName(name, untitledFolder) + "/" + key
		if flag(entry["disabled"]) {
			c.flag(messageDisabledScopeVariables, qualified)
			continue
		}
		value := text(entry["value"])
		switch {
		case text(entry["type"]) != postmanSecretType:
		case kind == labelCollection:
			settings.secrets = append(settings.secrets, key)
		default:
			value = ""
			c.flag(messageSecretVariables, qualified)
		}
		settings.vars = append(settings.vars, row{Key: key, Value: value, Enabled: true})
	}
	return settings
}

func (c *collector) postmanItems(items []any, folderID string, behavior map[string]any, depth int) {
	if depth >= maxFolderDepth {
		c.warnDepth()
		return
	}
	for _, entry := range items {
		item := object(entry)
		switch {
		case item == nil:
		case item["item"] != nil:
			name := text(item["name"])
			id := c.addScopedFolder(name, folderID, c.postmanScope(item, labelFolder, name))
			c.postmanItems(list(item["item"]), id, withBehavior(behavior, object(item["protocolProfileBehavior"])), depth+1)
		case item["request"] != nil:
			c.postmanRequest(item, folderID, withBehavior(behavior, object(item["protocolProfileBehavior"])))
		}
	}
}

func (c *collector) postmanRequest(item map[string]any, folderID string, behavior map[string]any) {
	name := text(item["name"])
	label := fmt.Sprintf(labelRequest, name)
	source := object(item["request"])
	if source == nil {
		source = map[string]any{"url": item["request"], "method": "GET"}
	}
	request := parts{
		name:        name,
		method:      text(source["method"]),
		description: describedText(source["description"]),
		headers:     postmanRows(source["header"]),
		preScript:   c.postmanScript(label, item, listenPreRequest),
		options:     c.postmanOptions(name, behavior),
		examples:    c.postmanExamples(name, item["response"]),
	}
	request.postScript, request.extractors, request.assertions = c.postmanAfterScript(label, item)
	request.url, request.params, request.vars = postmanURL(source["url"])
	if auth, set := c.postmanAuth(object(source["auth"])); set {
		request.auth = &auth
	}
	c.postmanBody(name, object(source["body"]), &request)
	c.build(request, folderID)
}

func (c *collector) postmanExamples(requestName string, responses any) string {
	var drafts []exampleDraft
	for _, response := range objects(responses) {
		drafts = append(drafts, exampleDraft{
			name:        text(response["name"]),
			status:      text(response["code"]),
			headers:     postmanRows(response["header"]),
			body:        text(response["body"]),
			contentType: exampleContentType(text(response["_postman_previewlanguage"])),
		})
	}
	return c.savedExamples(requestName, drafts)
}

func withBehavior(outer, inner map[string]any) map[string]any {
	if len(inner) == 0 {
		return outer
	}
	merged := make(map[string]any, len(outer)+len(inner))
	maps.Copy(merged, outer)
	maps.Copy(merged, inner)
	return merged
}

func (c *collector) postmanOptions(name string, behavior map[string]any) engine.Options {
	if strict, given := behavior[behaviorStrictSSL].(bool); given && !strict {
		c.flag(messageTLSKept, name)
	}
	var unmatched []string
	for _, key := range sortedKeys(behavior) {
		if !mappedBehaviors[key] && behavior[key] != nil && behavior[key] != false {
			unmatched = append(unmatched, key)
		}
	}
	if len(unmatched) > 0 {
		c.Warnings = append(c.Warnings, fmt.Sprintf(messagePostmanBehavior, name, strings.Join(unmatched, ", ")))
	}
	following, set := behavior[behaviorRedirects].(bool)
	withoutCookies := flag(behavior[behaviorCookies])
	return engine.Options{NoFollowRedirects: set && !following, SkipCookies: withoutCookies, DiscardCookies: withoutCookies}
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

func postmanURL(value any) (string, []row, []row) {
	source := object(value)
	if source == nil {
		return text(value), nil, nil
	}
	raw := text(source["raw"])
	if raw == "" {
		raw = composePostmanURL(source)
	}
	query := postmanRows(source["query"])
	if source["query"] != nil {
		raw, _, _ = strings.Cut(raw, "?")
	}
	address, vars := pathParamVariables(raw, usedPathParams(raw, objects(source["variable"])))
	return address, query, vars
}

func usedPathParams(raw string, entries []map[string]any) []row {
	base, _, _ := strings.Cut(raw, "?")
	segments := strings.Split(base, "/")
	var params []row
	for _, entry := range entries {
		if key := text(entry["key"]); slices.Contains(segments, ":"+key) {
			params = append(params, row{Key: key, Value: text(entry["value"])})
		}
	}
	return params
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
	return joinScripts(postmanEvents(node, listen, func(code string) string {
		return c.translateScript(postmanDialect, label, stageName(listen), code)
	}))
}

func (c *collector) postmanAfterScript(label string, item map[string]any) (string, string, string) {
	var rules []extractor
	var rows []assertion
	scripts := postmanEvents(item, listenTest, func(code string) string {
		translated, found, checks := c.translateAfterScript(postmanDialect, label, stagePost, code)
		rules, rows = append(rules, found...), append(rows, checks...)
		return translated
	})
	return joinScripts(scripts), encodeExtractors(rules), encodeChecks(rows)
}

func postmanEvents(node map[string]any, listen string, translate func(string) string) []string {
	var scripts []string
	for _, event := range objects(node["event"]) {
		if text(event["listen"]) != listen {
			continue
		}
		script := object(event["script"])
		if lines := list(script["exec"]); lines != nil {
			scripts = append(scripts, translate(joinLines(lines)))
		} else if code := text(script["exec"]); code != "" {
			scripts = append(scripts, translate(code))
		}
	}
	return scripts
}

func joinLines(lines []any) string {
	texts := make([]string, len(lines))
	for index, line := range lines {
		texts[index] = text(line)
	}
	return strings.Join(texts, "\n")
}

func (c *collector) postmanBody(name string, body map[string]any, request *parts) {
	if body == nil || flag(body["disabled"]) {
		return
	}
	switch text(body["mode"]) {
	case "raw":
		request.body = text(body["raw"])
		language := text(object(object(body["options"])["raw"])["language"])
		request.bodyType = rawBodyType(language, request.body, request.headers)
	case "urlencoded":
		request.body, request.bodyType = jsonList(postmanRows(body["urlencoded"])), bodyForm
	case "formdata":
		rows, typedText := postmanFormRows(objects(body["formdata"]))
		request.body, request.bodyType = jsonList(rows), bodyMultipart
		request.needsFiles = anyFile(rows)
		if typedText {
			c.flag(messagePartContentType, name)
		}
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

func postmanFormRows(entries []map[string]any) ([]row, bool) {
	var rows []row
	typedText := false
	for _, entry := range entries {
		candidate := row{Key: text(entry["key"]), Enabled: !flag(entry["disabled"]), Type: rowTypeText, Value: text(entry["value"])}
		if text(entry["type"]) == rowTypeFile {
			candidate = row{Key: candidate.Key, Enabled: candidate.Enabled, Type: rowTypeFile, FileName: baseName(text(entry["src"])), ContentType: text(entry["contentType"])}
		} else if text(entry["contentType"]) != "" {
			typedText = true
		}
		rows = append(rows, candidate)
	}
	return keyedRows(rows), typedText
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
	if kind == "" || kind == authInherit {
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
	case authEdgeGrid:
		return engine.Auth{Type: authEdgeGrid, EdgeGrid: engine.EdgeGridAuth{
			ClientToken: fields["clientToken"], ClientSecret: fields["clientSecret"], AccessToken: fields["accessToken"],
			Nonce: fields["nonce"], Timestamp: fields["timestamp"], HeadersToSign: fields["headersToSign"],
		}}, true
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

func (c *collector) readPostmanEnvironment(doc document) {
	root := object(doc.data)
	name := cleanName(text(root["name"]), strings.TrimSuffix(doc.file.Name, ".json"))
	c.read(name, FormatPostman, func() {
		draft := environmentDraft{name: name, global: text(root["_postman_variable_scope"]) == postmanGlobals}
		var disabled []string
		for _, entry := range objects(root["values"]) {
			key := text(entry["key"])
			switch {
			case key == "":
			case entry["enabled"] == false:
				disabled = append(disabled, key)
			default:
				draft.variables = append(draft.variables, envVariable{name: key, value: text(entry["value"]), enabled: true, secret: text(entry["type"]) == postmanSecretType})
			}
		}
		c.addDraftEnvironments([]environmentDraft{draft})
		if len(disabled) > 0 {
			c.Warnings = append(c.Warnings, fmt.Sprintf(messageDisabledVariables, name, listNames(disabled)))
		}
	})
}
