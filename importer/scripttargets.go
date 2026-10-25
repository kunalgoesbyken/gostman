package importer

import (
	"fmt"
	"slices"
	"strings"

	"github.com/dop251/goja/ast"
)

const (
	cryptoHelper     = "cryptoJs"
	dataRowHelper    = "withDataRow"
	cryptoEncoding   = `encoding === "base64" ? cryptoJs.enc.Base64 : cryptoJs.enc.Hex`
	randomAlphabet   = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	tableTemplate    = "<table><thead><tr>{{#each columns}}<th>{{this}}</th>{{/each}}</tr></thead><tbody>{{#each rows}}<tr>{{#each cells}}<td>{{this}}</td>{{/each}}</tr>{{/each}}</tbody></table>"
	postmanTableData = `{ columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows: rows.map((row) => ({ cells: Object.values(row) })) }`
)

var utilityShims = []shim{
	{"utils.uuid", `uuid: () => require("uuid").v4()`},
	{"utils.guid", `guid: () => require("uuid").v4()`},
	{"utils.md5", `md5: (text, encoding = "hex") => cryptoJs.MD5(text).toString(` + cryptoEncoding + `)`},
	{"utils.sha1", `sha1: (text, encoding = "hex") => cryptoJs.SHA1(text).toString(` + cryptoEncoding + `)`},
	{"utils.sha256", `sha256: (text, encoding = "hex") => cryptoJs.SHA256(text).toString(` + cryptoEncoding + `)`},
	{"utils.sha512", `sha512: (text, encoding = "hex") => cryptoJs.SHA512(text).toString(` + cryptoEncoding + `)`},
	{"utils.hmac", `hmac: (algorithm, key, text, encoding = "hex") => cryptoJs["Hmac" + algorithm.toUpperCase()](text, key).toString(` + cryptoEncoding + `)`},
	{"utils.base64.encode", `encode: (text) => cryptoJs.enc.Base64.stringify(cryptoJs.enc.Utf8.parse(text))`},
	{"utils.base64.decode", `decode: (text) => cryptoJs.enc.Base64.parse(text).toString(cryptoJs.enc.Utf8)`},
	{"utils.hex.encode", `encode: (text) => cryptoJs.enc.Hex.stringify(cryptoJs.enc.Utf8.parse(text))`},
	{"utils.hex.decode", `decode: (text) => cryptoJs.enc.Hex.parse(text).toString(cryptoJs.enc.Utf8)`},
	{"utils.url.encode", `encode: (text) => encodeURIComponent(text)`},
	{"utils.url.decode", `decode: (text) => decodeURIComponent(text)`},
	{"utils.date.now", `now: () => new Date().toISOString()`},
	{"utils.date.timestamp", `timestamp: (value = Date.now()) => new Date(value).getTime()`},
	{"utils.date.unix", `unix: (value = Date.now()) => Math.floor(new Date(value).getTime() / 1000)`},
	{"utils.random.int", `int: (low = 0, high = 100) => low + Math.floor(Math.random() * (high - low + 1))`},
	{"utils.random.string", `string: (length = 16, alphabet = "` + randomAlphabet + `") => Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")`},
	{"utils.random.pick", `pick: (items) => items[Math.floor(Math.random() * items.length)]`},
}

var utilityHelpers = []shim{{cryptoHelper, `const cryptoJs = require("crypto-js");`}}

var utilityNeeds = map[string]string{
	"utils.md5": cryptoHelper, "utils.sha1": cryptoHelper, "utils.sha256": cryptoHelper, "utils.sha512": cryptoHelper, "utils.hmac": cryptoHelper,
	"utils.base64.encode": cryptoHelper, "utils.base64.decode": cryptoHelper, "utils.hex.encode": cryptoHelper, "utils.hex.decode": cryptoHelper,
}

var utilityMissing = map[string]string{
	"utils.date.format": reasonDates,
	"utils.date.add":    reasonDates,
}

func withUtilities(shims []shim) []shim {
	return append(shims, utilityShims...)
}

func merged(maps ...map[string]string) map[string]string {
	all := map[string]string{}
	for _, entries := range maps {
		for key, value := range entries {
			all[key] = value
		}
	}
	return all
}

var postmanTarget = &scriptTarget{
	name:      "Postman",
	native:    map[string]bool{},
	foreign:   map[string]string{brunoRoot: messageExportForeign, insomniaRoot: messageExportForeign},
	wrapOpen:  "(async () => {",
	wrapClose: `})().catch((error) => pm.test("Script error", () => { throw error; }));`,
	helpers:   utilityHelpers,
	needs:     utilityNeeds,
	extract:   postmanExtract,
	shims: withUtilities([]shim{
		{"env.get", `get: (name) => pm.variables.get(name)`},
		{"env.has", `has: (name) => pm.variables.has(name)`},
		{"env.set", `set: (name, value) => pm.environment.set(name, value)`},
		{"env.unset", `unset: (name) => pm.environment.unset(name)`},
		{"env.all", `all: () => pm.variables.toObject()`},
		{"env.clear", `clear: () => pm.environment.clear()`},
		{"env.interpolate", `interpolate: (text) => pm.variables.replaceIn(text)`},
		{"env.name", `name: pm.environment.name`},
		{"env.session.get", `get: (name) => pm.variables.get(name)`},
		{"env.session.has", `has: (name) => pm.variables.has(name)`},
		{"env.session.set", `set: (name, value) => pm.variables.set(name, value)`},
		{"env.session.unset", `unset: (name) => pm.variables.unset(name)`},
		{"env.session.all", `all: () => pm.variables.toObject()`},
		{"env.session.clear", `clear: () => pm.variables.clear()`},
		{"env.collection.get", `get: (name) => pm.collectionVariables.get(name)`},
		{"env.collection.has", `has: (name) => pm.collectionVariables.has(name)`},
		{"env.collection.set", `set: (name, value) => pm.collectionVariables.set(name, value)`},
		{"env.collection.unset", `unset: (name) => pm.collectionVariables.unset(name)`},
		{"env.collection.all", `all: () => pm.collectionVariables.toObject()`},
		{"env.collection.clear", `clear: () => pm.collectionVariables.clear()`},
		{"env.globals.get", `get: (name) => pm.globals.get(name)`},
		{"env.globals.has", `has: (name) => pm.globals.has(name)`},
		{"env.globals.set", `set: (name, value) => pm.globals.set(name, value)`},
		{"env.globals.unset", `unset: (name) => pm.globals.unset(name)`},
		{"env.globals.all", `all: () => pm.globals.toObject()`},
		{"env.globals.clear", `clear: () => pm.globals.clear()`},
		{"req.name", `name: pm.info.requestName`},
		{"req.method", `get method() { return pm.request.method; }`},
		{"req.url", `get url() { return pm.request.url.toString(); }`},
		{"req.headers", `get headers() { return pm.request.headers.toObject(); }`},
		{"req.body", "get body() {\n  try { return JSON.parse(pm.request.body.raw); } catch (error) { return pm.request.body.raw; }\n}"},
		{"req.headerList", `headerList: pm.request.headers`},
		{"req.getName", `getName: () => pm.info.requestName`},
		{"req.getUrl", `getUrl: () => pm.request.url.toString()`},
		{"req.setUrl", `setUrl: (url) => pm.request.url.update(url)`},
		{"req.getHost", `getHost: () => pm.request.url.getHost()`},
		{"req.getPath", `getPath: () => pm.request.url.getPath()`},
		{"req.getQueryString", `getQueryString: () => pm.request.url.getQueryString()`},
		{"req.getMethod", `getMethod: () => pm.request.method`},
		{"req.setMethod", `setMethod: (method) => { pm.request.method = method; }`},
		{"req.getHeaders", `getHeaders: () => pm.request.headers.toObject()`},
		{"req.setHeaders", "setHeaders: (headers) => {\n  pm.request.headers.clear();\n  Object.entries(headers).forEach(([key, value]) => pm.request.headers.add({ key, value: String(value) }));\n}"},
		{"req.getHeader", `getHeader: (name) => pm.request.headers.get(name)`},
		{"req.setHeader", `setHeader: (name, value) => pm.request.headers.upsert({ key: name, value: String(value) })`},
		{"req.deleteHeader", `deleteHeader: (name) => pm.request.headers.remove(name)`},
		{"req.deleteHeaders", `deleteHeaders: (names) => names.forEach((name) => pm.request.headers.remove(name))`},
		{"req.getBody", "getBody: (options) => {\n  const raw = pm.request.body.raw;\n  if (options && options.raw) return raw;\n  try { return JSON.parse(raw); } catch (error) { return raw; }\n}"},
		{"req.setBody", `setBody: (body) => pm.request.body.update(typeof body === "string" ? body : JSON.stringify(body, null, 2))`},
		{"res.status", `status: pm.response.code`},
		{"res.statusText", `statusText: pm.response.status`},
		{"res.headers", `headers: Object.fromEntries(pm.response.headers.all().map((header) => [header.key.toLowerCase(), header.value]))`},
		{"res.body", "get body() {\n  try { return pm.response.json(); } catch (error) { return pm.response.text(); }\n}"},
		{"res.responseTime", `responseTime: pm.response.responseTime`},
		{"res.size", `size: pm.response.responseSize`},
		{"res.headerList", `headerList: pm.response.headers`},
		{"res.getStatus", `getStatus: () => pm.response.code`},
		{"res.getStatusText", `getStatusText: () => pm.response.status`},
		{"res.getHeaders", `getHeaders: () => pm.response.headers.toObject()`},
		{"res.getHeader", `getHeader: (name) => pm.response.headers.get(name)`},
		{"res.getBody", "getBody: () => {\n  try { return pm.response.json(); } catch (error) { return pm.response.text(); }\n}"},
		{"res.getResponseTime", `getResponseTime: () => pm.response.responseTime`},
		{"res.getSize", "getSize: () => {\n  const size = pm.response.size();\n  return { body: size.body, headers: size.header, total: size.total };\n}"},
		{"test", `(name, fn) => pm.test(name, fn)`},
		{"test.skip", `skip: (name, fn) => pm.test.skip(name, fn)`},
		{"expect", `pm.expect`},
		{"sendRequest", `(request) => new Promise((resolve, reject) => {
  const fill = (text) => pm.variables.replaceIn(String(text));
  const options = typeof request === "string" ? { url: request } : request;
  const body = options.body === undefined || typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  const header = Object.fromEntries(Object.entries(options.headers || {}).map(([key, value]) => [key, fill(value)]));
  const target = { url: fill(options.url), method: options.method || "GET", header, body: body === undefined ? undefined : { mode: "raw", raw: fill(body) } };
  pm.sendRequest(target, (error, response) => {
    if (error) return reject(error);
    let parsed;
    try { parsed = response.json(); } catch (failure) { parsed = response.text(); }
    resolve({ status: response.code, statusText: response.status, headers: response.headers.toObject(), body: parsed, responseTime: response.responseTime });
  });
})`},
		{"setNextRequest", `(name) => pm.execution.setNextRequest(name)`},
		{"skipRequest", `() => pm.execution.skipRequest()`},
		{"stopExecution", `() => pm.execution.setNextRequest(null)`},
		{"visualize", `(template, data) => pm.visualizer.set(template, data)`},
		{"visualize.table", `table: (rows) => pm.visualizer.set("` + tableTemplate + `", ` + postmanTableData + `)`},
	}),
	missing: merged(utilityMissing, map[string]string{
		"res":            reasonQueries,
		"res.url":        reasonPostmanFinalURL,
		"res.setBody":    reasonPostmanResponseBody,
		"req.timeout":    reasonPostmanTimeout,
		"req.getTimeout": reasonPostmanTimeout,
		"req.setTimeout": reasonPostmanTimeout,
	}),
	hints: map[string]string{"matchSchema": messageExportMatchSchema},
	calls: map[string]func(call *ast.CallExpression) string{"sendRequest": postmanSavedRequest},
	schema: func(actual, schema string) string {
		return fmt.Sprintf("expect(%s).to.have.jsonSchema(%s)", actual, schema)
	},
}

func postmanSavedRequest(call *ast.CallExpression) string {
	if len(call.ArgumentList) == 0 {
		return ""
	}
	if literal, ok := call.ArgumentList[0].(*ast.StringLiteral); ok && !looksLikeAddress(string(literal.Value)) {
		return fmt.Sprintf(messageExportSavedRequest, string(literal.Value))
	}
	return ""
}

var brunoTarget = &scriptTarget{
	name:       "Bruno",
	native:     map[string]bool{"req": true, "res": true, "test": true, "expect": true},
	foreign:    map[string]string{postmanRoot: messageExportForeign, insomniaRoot: messageExportForeign},
	helpers:    append(slices.Clone(utilityHelpers), shim{dataRowHelper, `const withDataRow = (text) => Object.entries(bru.runner.iterationData.get()).reduce((result, [name, value]) => result.replaceAll("{{" + name + "}}", value), String(text));`}),
	needs:      merged(utilityNeeds, map[string]string{"env.interpolate": dataRowHelper, savedRequestCall: dataRowHelper}),
	extract:    brunoExtract,
	assertRows: true,
	shims: withUtilities([]shim{
		{"env.get", `get: (name) => bru.getVar(name) ?? bru.runner.iterationData.get(name) ?? bru.getRequestVar(name) ?? bru.getFolderVar(name) ?? bru.getEnvVar(name) ?? bru.getCollectionVar(name) ?? bru.getGlobalEnvVar(name)`},
		{"env.has", `has: (name) => bru.hasVar(name) || bru.runner.iterationData.has(name) || bru.hasEnvVar(name) || bru.hasCollectionVar(name) || bru.hasGlobalEnvVar(name)`},
		{"env.set", `set: (name, value) => bru.setEnvVar(name, value)`},
		{"env.unset", `unset: (name) => bru.deleteEnvVar(name)`},
		{"env.all", `all: () => ({ ...bru.getAllEnvVars(), ...bru.getAllVars() })`},
		{"env.clear", `clear: () => bru.deleteAllEnvVars()`},
		{"env.interpolate", `interpolate: (text) => bru.interpolate(withDataRow(text))`},
		{"env.name", `name: bru.getEnvName()`},
		{"env.session.get", `get: (name) => bru.getVar(name)`},
		{"env.session.has", `has: (name) => bru.hasVar(name)`},
		{"env.session.set", `set: (name, value) => bru.setVar(name, value)`},
		{"env.session.unset", `unset: (name) => bru.deleteVar(name)`},
		{"env.session.all", `all: () => bru.getAllVars()`},
		{"env.session.clear", `clear: () => bru.deleteAllVars()`},
		{"env.collection.get", `get: (name) => bru.getCollectionVar(name)`},
		{"env.collection.has", `has: (name) => bru.hasCollectionVar(name)`},
		{"env.collection.set", `set: (name, value) => bru.setCollectionVar(name, value)`},
		{"env.collection.unset", `unset: (name) => bru.deleteCollectionVar(name)`},
		{"env.collection.clear", `clear: () => bru.deleteAllCollectionVars()`},
		{"env.globals.get", `get: (name) => bru.getGlobalEnvVar(name)`},
		{"env.globals.has", `has: (name) => bru.hasGlobalEnvVar(name)`},
		{"env.globals.set", `set: (name, value) => bru.setGlobalEnvVar(name, value)`},
		{"env.globals.unset", `unset: (name) => bru.deleteGlobalEnvVar(name)`},
		{"env.globals.all", `all: () => bru.getAllGlobalEnvVars()`},
		{"env.globals.clear", `clear: () => bru.deleteAllGlobalEnvVars()`},
		{"sendRequest", `async (request) => {
  const fill = (text) => bru.interpolate(withDataRow(text));
  const response = typeof request === "string"
    ? await ` + fmt.Sprintf(runRequestCall, runRequestTarget) + `
    : await bru.sendRequest({ method: request.method || "GET", url: fill(request.url), headers: Object.fromEntries(Object.entries(request.headers || {}).map(([key, value]) => [key, fill(value)])), data: typeof request.body === "string" ? fill(request.body) : request.body, timeout: request.timeout });
  return { ...response, body: response.data };
}`},
		{"setNextRequest", `(name) => bru.runner.setNextRequest(name)`},
		{"skipRequest", `() => bru.runner.skipRequest()`},
		{"stopExecution", `() => bru.runner.stopExecution()`},
	}),
	missing: merged(utilityMissing, map[string]string{
		"env.collection.all": reasonBrunoCollectionList,
		"visualize":          reasonBrunoVisualize,
		"visualize.table":    reasonBrunoVisualize,
	}),
	hints: map[string]string{"matchSchema": messageExportBrunoSchema, "jsonSchema": messageExportBrunoSchema},
	schema: func(actual, schema string) string {
		return fmt.Sprintf("expect(new (require(\"ajv\"))().validate(%s, %s)).to.be.true", schema, actual)
	},
}

func looksLikeAddress(text string) bool {
	lowered := strings.ToLower(strings.TrimSpace(text))
	return strings.HasPrefix(lowered, "http://") || strings.HasPrefix(lowered, "https://") || strings.HasPrefix(lowered, placeholderStart)
}

var insomniaTarget = withRoot(postmanTarget, "Insomnia", postmanRoot+".", insomniaRoot+".")

func withRoot(base *scriptTarget, name, from, to string) *scriptTarget {
	renamed := *base
	renamed.name = name
	renamed.wrapClose = strings.ReplaceAll(base.wrapClose, from, to)
	renamed.shims = make([]shim, len(base.shims))
	for index, entry := range base.shims {
		renamed.shims[index] = shim{key: entry.key, text: strings.ReplaceAll(entry.text, from, to)}
	}
	return &renamed
}

func exportedTarget(d *dialect) *scriptTarget {
	for _, target := range []*scriptTarget{postmanTarget, brunoTarget, insomniaTarget} {
		if target.name == d.name {
			return target
		}
	}
	return nil
}
