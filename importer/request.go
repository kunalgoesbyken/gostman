package importer

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
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
	tags         []string
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
	examples     string
	graphqlQuery string
	graphqlVars  string
	options      engine.Options
	needsFiles   bool

	id             string
	grpcMethod     string
	grpcMessage    string
	grpcProtos     string
	socketProtocol string
	socketMessages string
}

func (c *collector) build(p parts, folderID string) {
	request := newRequest(p.name, p.method, "")
	request.URL, request.QueryParams = withQuery(p.url, p.params)
	request.Description = p.description
	request.Tags = workspace.NormalizeTags(p.tags)
	request.FolderId = folderID
	request.Headers = jsonList(p.headers)
	request.Vars = jsonList(p.vars)
	request.Body, request.BodyType = p.body, p.bodyType
	request.GraphqlQuery, request.GraphqlVariables = p.graphqlQuery, p.graphqlVars
	request.Auth = c.requestAuth(p.auth, folderID)
	request.PreScript, request.PostScript = p.preScript, p.postScript
	request.Assertions, request.Extractors, request.Examples = p.assertions, p.extractors, p.examples
	request.Options = p.options
	request.Options.InsecureTLS = false
	request.GrpcMethod, request.GrpcMessage, request.GrpcProtos = p.grpcMethod, p.grpcMessage, p.grpcProtos
	request.SocketProtocol, request.SocketMessages = p.socketProtocol, p.socketMessages
	if p.id != "" {
		request.Id = p.id
	}
	c.flagScripts(request.Name, request.PreScript, request.PostScript)
	if request.Auth.Type == authOAuth2 {
		c.flag(locales.ImporterOauth, request.Name)
	}
	if p.needsFiles {
		c.flag(locales.ImporterFiles, request.Name)
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
