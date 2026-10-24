package importer

import "strings"

var jetbrainsDialect = &dialect{
	name:  "JetBrains HTTP Client",
	api:   "client.*",
	roots: setOf("client", "response", "request"),
	objects: map[string]string{
		"response.body":   responseRoot + ".body",
		"response.status": responseRoot + ".status",
	},
	calls: map[string]callRule{
		"client.test":              rename("test"),
		"client.assert":            jetbrainsAssert,
		"client.log":               rename("console.log"),
		"client.global.get":        rename(environmentAccess + ".get"),
		"client.global.set":        rename(environmentAccess + ".set"),
		"client.global.clear":      rename(environmentAccess + ".unset"),
		"request.variables.get":    rename(sessionAccess + ".get"),
		"request.variables.set":    rename(sessionAccess + ".set"),
		"request.environment.get":  rename(environmentAccess + ".get"),
		"response.headers.valueOf": rename(responseRoot + ".getHeader"),
	},
}

func jetbrainsAssert(args []string) (string, bool) {
	if len(args) == 0 || len(args) > 2 {
		return "", false
	}
	return "expect(" + strings.Join(args, ", ") + ").to.be.ok", true
}
