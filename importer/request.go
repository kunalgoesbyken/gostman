package importer

import (
	"strings"

	"github.com/krockxz/gostman/engine"
)

const (
	bodyNone      = ""
	bodyJSON      = "json"
	bodyText      = "text"
	bodyXML       = "xml"
	bodyForm      = "form"
	bodyMultipart = "multipart"
	bodyBinary    = "binary"
	methodGraphQL = "GRAPHQL"
)

type parts struct {
	name         string
	method       string
	url          string
	description  string
	headers      []row
	params       []row
	body         string
	bodyType     string
	auth         *engine.Auth
	vars         []row
	preScript    string
	postScript   string
	assertions   string
	extractors   string
	graphqlQuery string
	graphqlVars  string
	options      engine.Options
	needsFiles   bool
}

func (c *collector) build(p parts, inherited scope, folderID string) {
	request := newRequest(p.name, p.method, "")
	request.URL, request.QueryParams = withQuery(p.url, p.params)
	request.Description = p.description
	request.FolderId = folderID
	request.Headers = rowsJSON(mergeRows(inherited.headers, p.headers))
	request.Vars = rowsJSON(mergeRows(inherited.vars, p.vars))
	request.Body, request.BodyType = p.body, p.bodyType
	request.GraphqlQuery, request.GraphqlVariables = p.graphqlQuery, p.graphqlVars
	request.Auth = inherited.authFor(p.auth)
	request.PreScript = inherited.preScript(p.preScript)
	request.PostScript = inherited.postScript(p.postScript)
	request.Assertions, request.Extractors = p.assertions, p.extractors
	request.Options = p.options
	request.Options.InsecureTLS = false
	c.flagScripts(request.Name, request.PreScript, request.PostScript)
	if request.Auth.Type == authOAuth2 {
		c.flag(messageOAuth, request.Name)
	}
	if p.needsFiles {
		c.flag(messageFiles, request.Name)
	}
	c.addRequest(request)
}

func bodyMime(bodyType string) string {
	switch bodyType {
	case bodyJSON:
		return "application/json"
	case bodyXML:
		return "application/xml"
	}
	return "text/plain"
}

func bodyTypeOfMime(mime string) string {
	essence := strings.ToLower(strings.TrimSpace(strings.SplitN(mime, ";", 2)[0]))
	switch {
	case essence == "application/x-www-form-urlencoded":
		return bodyForm
	case essence == "multipart/form-data":
		return bodyMultipart
	case essence == "application/octet-stream":
		return bodyBinary
	case essence == "application/json" || strings.HasSuffix(essence, "+json"):
		return bodyJSON
	case essence == "application/xml" || essence == "text/xml" || strings.HasSuffix(essence, "+xml"):
		return bodyXML
	}
	return bodyText
}
