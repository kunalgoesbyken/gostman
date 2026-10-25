package importer

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	methodGRPC             = "GRPC"
	methodWebSocket        = "GET"
	grpcScheme             = "grpc://"
	grpcSecureScheme       = "grpcs://"
	defaultMaxRedirects    = "5"
	streamingClient        = "client-streaming"
	streamingBidirectional = "bidi-streaming"
)

type socketMessage struct {
	Name   string `json:"name"`
	Body   string `json:"body"`
	Target string `json:"target"`
}

type grpcCall struct {
	url        string
	method     string
	methodType string
	protoPath  string
	messages   []string
}

type requestSettings struct {
	timeout         string
	followRedirects string
	maxRedirects    string
}

func (c *collector) grpcParts(root string, call grpcCall, request *parts) {
	request.method = methodGRPC
	request.url = grpcAddress(call.url)
	request.grpcMethod = strings.TrimPrefix(call.method, "/")
	request.grpcMessage = grpcMessage(call)
	if call.protoPath == "" {
		return
	}
	files, found := c.protoSet(root, call.protoPath)
	if !found {
		c.flag(locales.ImporterProtoMissing, request.name)
		return
	}
	request.grpcProtos = jsonList(files)
}

func grpcAddress(address string) string {
	switch {
	case strings.HasPrefix(address, "https://"):
		return grpcSecureScheme + strings.TrimPrefix(address, "https://")
	case strings.HasPrefix(address, "http://"):
		return grpcScheme + strings.TrimPrefix(address, "http://")
	case strings.Contains(address, "://") || strings.HasPrefix(address, variableOpen) || address == "":
		return address
	}
	return grpcScheme + address
}

func grpcMessage(call grpcCall) string {
	var messages []string
	for _, message := range call.messages {
		if strings.TrimSpace(message) != "" {
			messages = append(messages, message)
		}
	}
	switch {
	case len(messages) == 0:
		return ""
	case len(messages) > 1 && (call.methodType == streamingClient || call.methodType == streamingBidirectional):
		return "[\n" + strings.Join(messages, ",\n") + "\n]"
	}
	return messages[0]
}

func socketParts(address string, messages []socketMessage, request *parts) {
	request.method = methodWebSocket
	request.url = address
	request.socketMessages = jsonList(messages)
}

func (c *collector) settingsOptions(name string, settings requestSettings) engine.Options {
	var options engine.Options
	if timeout, err := strconv.Atoi(settings.timeout); err == nil && timeout > 0 {
		options.TimeoutMs = timeout
	}
	switch {
	case settings.followRedirects == "false":
		options.NoFollowRedirects = true
	case settings.maxRedirects != "" && settings.maxRedirects != defaultMaxRedirects && settings.maxRedirects != authInherit:
		c.flag(locales.ImporterMaxRedirects, name)
	}
	return options
}

func pathParamVariables(address string, params []row) (string, []row) {
	var filled, vars []row
	for _, param := range params {
		switch {
		case param.Key == "" || param.Value == "":
		case strings.Contains(param.Value, variableOpen):
			filled = append(filled, row{Key: param.Key, Value: param.Value})
		default:
			filled = append(filled, row{Key: param.Key, Value: variableOpen + param.Key + variableClose})
			vars = append(vars, row{Key: param.Key, Value: param.Value, Enabled: true})
		}
	}
	return applyPathParams(address, filled), vars
}

func applyPathParams(address string, params []row) string {
	base, query, hasQuery := strings.Cut(address, "?")
	segments := strings.Split(base, "/")
	for index, segment := range segments {
		name, isParam := strings.CutPrefix(segment, ":")
		if !isParam || name == "" {
			continue
		}
		for _, param := range params {
			if param.Key == name && param.Value != "" {
				segments[index] = param.Value
			}
		}
	}
	rebuilt := strings.Join(segments, "/")
	if hasQuery {
		return rebuilt + "?" + query
	}
	return rebuilt
}

var droppedScriptCodes = map[locales.Code]locales.Code{
	locales.ImporterPlaceCollection: locales.ImporterGrpcScriptsCollection,
	locales.ImporterPlaceFolder:     locales.ImporterGrpcScriptsFolder,
	locales.ImporterPlaceRequest:    locales.ImporterGrpcScriptsRequest,
}

func droppedScripts(label locales.Message, kinds []string) locales.Message {
	return locales.New(droppedScriptCodes[label.Code], locales.Params{"name": label.Params["name"], "kinds": strings.Join(kinds, ", ")})
}

type importMark struct {
	requests int
	folders  int
}

func (c *collector) mark() importMark {
	return importMark{requests: len(c.Requests), folders: len(c.Folders)}
}

func (c *collector) noteDotEnv(collection string, since importMark) {
	if c.inPlace || since.requests > len(c.Requests) || since.folders > len(c.Folders) {
		return
	}
	encoded, err := json.Marshal([]any{c.Requests[since.requests:], c.Folders[since.folders:], c.Variables})
	if err == nil && strings.Contains(string(encoded), processPrefix) {
		c.lead(locales.New(locales.ImporterDotEnv, locales.Params{"name": collection, "example": "{{process.env.NAME}}"}))
	}
}
