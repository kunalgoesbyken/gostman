package mcpclient

import (
	"encoding/json"
	"slices"

	"github.com/kunalgoesbyken/gostman/mcp"
)

const (
	ModernVersion = "2026-07-28"

	MethodDiscover      = "server/discover"
	MethodListTools     = mcp.MethodListTools
	MethodCallTool      = mcp.MethodCallTool
	MethodListResources = "resources/list"
	MethodListTemplates = "resources/templates/list"
	MethodReadResource  = "resources/read"
	MethodListPrompts   = "prompts/list"
	MethodGetPrompt     = "prompts/get"
	fieldMeta           = "_meta"

	metaVersion      = "io.modelcontextprotocol/protocolVersion"
	metaClientInfo   = "io.modelcontextprotocol/clientInfo"
	metaCapabilities = "io.modelcontextprotocol/clientCapabilities"
	metaLogLevel     = "io.modelcontextprotocol/logLevel"
	metaProgress     = "progressToken"
	logLevelDebug    = "debug"

	fieldRequestState = "requestState"

	resultComplete      = "complete"
	resultInputRequired = "input_required"

	codeHeaderMismatch     = -32020
	codeMissingCapability  = -32021
	codeUnsupportedVersion = -32022

	capabilityTools     = "tools"
	capabilityResources = "resources"
	capabilityPrompts   = "prompts"
)

var modernCodes = []int{codeHeaderMismatch, codeMissingCapability, codeUnsupportedVersion}

var operations = map[string]bool{MethodCallTool: true, MethodReadResource: true, MethodGetPrompt: true}

func isModernCode(code int) bool {
	return slices.Contains(modernCodes, code)
}

type welcome struct {
	ProtocolVersion string                     `json:"protocolVersion"`
	Server          mcp.Implementation         `json:"serverInfo"`
	Instructions    string                     `json:"instructions"`
	Capabilities    map[string]json.RawMessage `json:"capabilities"`
}

func (w welcome) offers(capability string) bool {
	_, offered := w.Capabilities[capability]
	return offered
}

type discoverResult struct {
	SupportedVersions []string                   `json:"supportedVersions"`
	Capabilities      map[string]json.RawMessage `json:"capabilities"`
	Instructions      string                     `json:"instructions"`
	Meta              struct {
		Server mcp.Implementation `json:"io.modelcontextprotocol/serverInfo"`
	} `json:"_meta"`
}

type versionRefusal struct {
	Supported []string `json:"supported"`
}

type resultHeader struct {
	ResultType    string                     `json:"resultType"`
	InputRequests map[string]json.RawMessage `json:"inputRequests"`
	RequestState  string                     `json:"requestState"`
}
