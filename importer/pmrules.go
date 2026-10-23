package importer

import "strings"

const (
	postmanRoot         = "pm"
	legacyRoot          = "postman"
	responseRoot        = "res"
	jsonSchemaAssertion = "jsonSchema"
	environmentAccess   = "env"
)

type callRule func(args []string) (string, bool)

var (
	supportedModules = map[string]bool{"lodash": true, "crypto-js": true, "moment": true, "dayjs": true, "uuid": true, "ajv": true, "chai": true}

	postmanDialect = &dialect{
		name:     "Postman",
		api:      "pm.*",
		roots:    map[string]bool{postmanRoot: true, legacyRoot: true},
		response: postmanRoot + ".response",
		properties: map[string]string{
			"pm.request.method": "req.method",
			"pm.request.url":    "req.url",
		},
		calls:    buildCallRules(),
		specials: map[string]special{"pm.sendRequest": (*translator).renderSendRequest},
		scoped:   map[string]bool{"pm.globals": true, "pm.collectionVariables": true, "pm.variables": true, "pm.iterationData": true},
		retired: map[string]bool{
			"tests": true, "responseBody": true, "responseCode": true, "responseHeaders": true,
			"tv4": true, "xml2Json": true, "cheerio": true,
		},
		implicit: map[string]string{"_": "lodash", "CryptoJS": "crypto-js", "moment": "moment"},
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
		"postman.setNextRequest":           rename("setNextRequest"),
		"postman.setEnvironmentVariable":   rename("env.set"),
		"postman.setGlobalVariable":        rename("env.set"),
		"postman.getEnvironmentVariable":   rename("env.get"),
		"postman.getGlobalVariable":        rename("env.get"),
		"postman.clearEnvironmentVariable": rename("env.unset"),
		"postman.clearGlobalVariable":      rename("env.unset"),
	}
	for _, scope := range []string{"environment", "globals", "collectionVariables", "variables"} {
		for _, name := range []string{"get", "set", "has", "unset"} {
			rules["pm."+scope+"."+name] = rename(environmentAccess + "." + name)
		}
		rules["pm."+scope+".toObject"] = withoutArguments(environmentAccess + ".all()")
	}
	for _, name := range []string{"get", "has"} {
		rules["pm.iterationData."+name] = rename(environmentAccess + "." + name)
	}
	rules["pm.iterationData.toObject"] = withoutArguments(environmentAccess + ".all()")
	return rules
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
		return "(typeof " + root + ".body === 'string' ? " + root + ".body : JSON.stringify(" + root + ".body))", len(args) == 0
	case "headers.get":
		return root + ".getHeader(" + strings.Join(args, ", ") + ")", len(args) == 1
	case "to.have.status":
		return "expect(" + root + ".status).to.equal(" + strings.Join(args, ", ") + ")", len(args) == 1
	}
	return "", false
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
	case "to.be.ok":
		return "expect(" + root + ".status).to.be.within(200, 299)", true
	}
	return "", false
}
