package importer

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
)

const (
	postmanRoot       = "pm"
	legacyRoot        = "postman"
	responseRoot      = "res"
	environmentAccess = "env"
	sessionAccess     = environmentAccess + ".session"
	collectionAccess  = environmentAccess + ".collection"
	globalAccess      = environmentAccess + ".globals"
	legacyTests       = "tests"
	responseText      = "(typeof %[1]s.body === 'string' ? %[1]s.body : JSON.stringify(%[1]s.body))"
)

type callRule func(args []string) (string, bool)

var (
	supportedModules = map[string]bool{"lodash": true, "crypto-js": true, "moment": true, "dayjs": true, "uuid": true, "ajv": true, "chai": true}

	postmanDialect = &dialect{
		name: "Postman",
		api:  "pm.*",
		roots: map[string]bool{
			postmanRoot: true, legacyRoot: true, "tv4": true,
			"responseBody": true, "responseCode": true, "responseHeaders": true, "responseTime": true,
		},
		response: postmanRoot + ".response",
		properties: map[string]string{
			"pm.request.method":      "req.method",
			"pm.request.url":         "req.url",
			"pm.request.headers":     "req.headerList",
			"pm.request.body.raw":    "req.getBody({ raw: true })",
			"pm.environment.name":    "env.name",
			"pm.info.requestName":    "req.name",
			"pm.info.iteration":      "(Number(env.get('iteration') || 1) - 1)",
			"pm.info.iterationCount": "Number(env.get('iterationCount') || 1)",
			"responseBody":           fmt.Sprintf(responseText, responseRoot),
			"responseCode.code":      responseRoot + ".status",
			"responseHeaders":        responseRoot + ".headers",
			"responseTime":           responseRoot + ".responseTime",
		},
		calls:    buildCallRules(),
		specials: map[string]special{"pm.sendRequest": (*translator).renderSendRequest},
		retired:  map[string]bool{legacyTests: true, "xml2Json": true, "cheerio": true},
		implicit: map[string]string{"_": "lodash", "CryptoJS": "crypto-js", "moment": "moment"},
	}

	postmanScopes = map[string]string{
		"environment":         environmentAccess,
		"variables":           sessionAccess,
		"collectionVariables": collectionAccess,
		"globals":             globalAccess,
	}
	listMethods    = []string{"get", "has", "one", "all", "count", "idx", "indexOf", "each", "find", "filter", "map", "reduce", "toObject", "toString"}
	editingMethods = []string{"add", "upsert", "remove", "clear"}
	statusClasses  = map[string][2]int{
		"info": {100, 199}, "success": {200, 299}, "redirection": {300, 399},
		"clientError": {400, 499}, "serverError": {500, 599}, "error": {400, 599},
	}
	statusCodes = map[string]int{
		"ok": 200, "accepted": 202, "withoutContent": 204, "badRequest": 400, "unauthorized": 401,
		"forbidden": 403, "notFound": 404, "rateLimited": 429,
	}
)

func buildCallRules() map[string]callRule {
	rules := map[string]callRule{
		"pm.test":                          rename("test"),
		"pm.expect":                        rename("expect"),
		"pm.setNextRequest":                rename("setNextRequest"),
		"pm.execution.setNextRequest":      rename("setNextRequest"),
		"pm.execution.skipRequest":         rename("skipRequest"),
		"pm.request.headers.get":           rename("req.getHeader"),
		"pm.request.url.toString":          withoutArguments("req.getUrl()"),
		"pm.request.url.getHost":           withoutArguments("req.getHost()"),
		"pm.request.url.getPath":           withoutArguments("req.getPath()"),
		"pm.request.url.getQueryString":    withoutArguments("req.getQueryString()"),
		"pm.request.body.toString":         withoutArguments("req.getBody({ raw: true })"),
		"pm.request.body.update":           updateBody,
		"pm.visualizer.set":                upTo(2, rename("visualize")),
		"postman.getResponseHeader":        upTo(1, rename(responseRoot+".getHeader")),
		"tv4.validate":                     validateSchema,
		"postman.setNextRequest":           rename("setNextRequest"),
		"postman.setEnvironmentVariable":   rename("env.set"),
		"postman.setGlobalVariable":        rename(globalAccess + ".set"),
		"postman.getEnvironmentVariable":   rename("env.get"),
		"postman.getGlobalVariable":        rename(globalAccess + ".get"),
		"postman.clearEnvironmentVariable": rename("env.unset"),
		"postman.clearGlobalVariable":      rename(globalAccess + ".unset"),
	}
	for scope, access := range postmanScopes {
		for _, name := range []string{"get", "set", "has", "unset"} {
			rules["pm."+scope+"."+name] = rename(access + "." + name)
		}
		rules["pm."+scope+".toObject"] = withoutArguments(access + ".all()")
		rules["pm."+scope+".clear"] = withoutArguments(access + ".clear()")
		rules["pm."+scope+".replaceIn"] = rename(access + ".interpolate")
	}
	for _, name := range []string{"get", "has"} {
		rules["pm.iterationData."+name] = rename(environmentAccess + "." + name)
	}
	rules["pm.iterationData.toObject"] = withoutArguments(environmentAccess + ".all()")
	for _, name := range append(append([]string{}, listMethods...), editingMethods...) {
		if name != "get" {
			rules["pm.request.headers."+name] = rename("req.headerList." + name)
		}
	}
	for _, name := range listMethods {
		rules["pm.cookies."+name] = rename("bru.cookies." + name)
	}
	return rules
}

func upTo(limit int, rule callRule) callRule {
	return func(args []string) (string, bool) {
		replacement, ok := rule(args)
		return replacement, ok && len(args) <= limit
	}
}

func updateBody(args []string) (string, bool) {
	if len(args) != 1 || strings.HasPrefix(strings.TrimSpace(args[0]), "{") {
		return "", false
	}
	return "req.setBody(" + args[0] + ")", true
}

func validateSchema(args []string) (string, bool) {
	if len(args) != 2 {
		return "", false
	}
	return "new (require('ajv'))().validate(" + args[1] + ", " + args[0] + ")", true
}

func rename(target string) callRule {
	return func(args []string) (string, bool) {
		return target + "(" + strings.Join(args, ", ") + ")", true
	}
}

func withoutArguments(replacement string) callRule {
	return func(args []string) (string, bool) {
		return replacement, len(args) == 0
	}
}

func responseCall(root, path string, args []string) (string, bool) {
	switch path {
	case "json":
		return root + ".body", len(args) == 0
	case "text":
		return fmt.Sprintf(responseText, root), len(args) == 0
	case "headers.get":
		return root + ".getHeader(" + strings.Join(args, ", ") + ")", len(args) == 1
	case "to.have.status":
		return "expect(" + root + ".status).to.equal(" + strings.Join(args, ", ") + ")", len(args) == 1
	case "to.have.jsonSchema":
		return "expect(" + root + ".body).to.have.jsonSchema(" + strings.Join(args, ", ") + ")", len(args) >= 1
	case "to.have.header":
		return headerAssertion(root, args)
	case "to.have.body":
		return bodyAssertion(root, args)
	case "to.have.jsonBody":
		return jsonBodyAssertion(root, args)
	}
	if method, found := strings.CutPrefix(path, "headers."); found && slices.Contains(listMethods, method) {
		return root + ".headerList." + method + "(" + strings.Join(args, ", ") + ")", true
	}
	return "", false
}

func headerAssertion(root string, args []string) (string, bool) {
	switch len(args) {
	case 1:
		return "expect(" + root + ".getHeader(" + args[0] + ")).to.exist", true
	case 2:
		return "expect(" + root + ".getHeader(" + args[0] + ")).to.equal(" + args[1] + ")", true
	}
	return "", false
}

func bodyAssertion(root string, args []string) (string, bool) {
	body := "expect(" + fmt.Sprintf(responseText, root) + ")"
	switch {
	case len(args) == 0:
		return body + ".to.not.be.empty", true
	case len(args) > 1:
		return "", false
	case strings.HasPrefix(args[0], "/"):
		return body + ".to.match(" + args[0] + ")", true
	}
	return body + ".to.equal(" + args[0] + ")", true
}

func jsonBodyAssertion(root string, args []string) (string, bool) {
	body := "expect(" + root + ".body)"
	switch {
	case len(args) == 0:
		return body + ".to.not.be.a('string')", true
	case len(args) == 2:
		return body + ".to.have.deep.nested.property(" + args[0] + ", " + args[1] + ")", true
	case len(args) > 2:
		return "", false
	case strings.HasPrefix(args[0], "{") || strings.HasPrefix(args[0], "["):
		return body + ".to.deep.equal(" + args[0] + ")", true
	}
	return body + ".to.have.nested.property(" + args[0] + ")", true
}

func responseProperty(root, path string) (string, bool) {
	switch path {
	case "code":
		return root + ".status", true
	case "status":
		return root + ".statusText", true
	case "responseTime":
		return root + ".responseTime", true
	case "headers":
		return root + ".headers", true
	case "responseSize":
		return root + ".size", true
	case "to.be.json":
		return "expect(String(" + root + ".getHeader('content-type'))).to.include('json')", true
	}
	return statusAssertion(root, path)
}

func statusAssertion(root, path string) (string, bool) {
	subject := "expect(" + root + ".status).to."
	name, found := strings.CutPrefix(path, "to.be.")
	if negated, isNegated := strings.CutPrefix(path, "to.not.be."); isNegated {
		name, found, subject = negated, true, subject+"not."
	}
	if !found {
		return "", false
	}
	if code, known := statusCodes[name]; known {
		return subject + "equal(" + strconv.Itoa(code) + ")", true
	}
	if bounds, known := statusClasses[name]; known {
		return subject + "be.within(" + strconv.Itoa(bounds[0]) + ", " + strconv.Itoa(bounds[1]) + ")", true
	}
	return "", false
}
