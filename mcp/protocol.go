package mcp

import (
	"bytes"
	"encoding/json"
)

const (
	JSONRPCVersion = "2.0"

	MethodInitialize  = "initialize"
	MethodInitialized = "notifications/initialized"
	MethodPing        = "ping"
	MethodListTools   = "tools/list"
	MethodCallTool    = "tools/call"
	methodCancelled   = "notifications/cancelled"
	methodProgress    = "notifications/progress"
	methodDiscover    = "server/discover"

	metaVersion      = "io.modelcontextprotocol/protocolVersion"
	metaCapabilities = "io.modelcontextprotocol/clientCapabilities"
	resultComplete   = "complete"
	privateCache     = "private"

	codeParseError     = -32700
	codeInvalidRequest = -32600
	CodeMethodNotFound = -32601
	codeInvalidParams  = -32602

	codeHeaderMismatch     = -32020
	codeUnsupportedVersion = -32022

	contentText = "text"
)

var ProtocolVersions = []string{"2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"}

var statelessVersions = []string{"2026-07-28"}

var absentID = json.RawMessage("null")

type Message struct {
	Version string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type Failure struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

type Reply struct {
	Version string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *Failure        `json:"error,omitempty"`
}

type InitializeParams struct {
	ProtocolVersion string `json:"protocolVersion"`
}

type Implementation struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type toolCapability struct{}

type capabilities struct {
	Tools toolCapability `json:"tools"`
}

type InitializeResult struct {
	ProtocolVersion string         `json:"protocolVersion"`
	Capabilities    capabilities   `json:"capabilities"`
	ServerInfo      Implementation `json:"serverInfo"`
	Instructions    string         `json:"instructions,omitempty"`
}

type annotations struct {
	Title       string `json:"title,omitempty"`
	ReadOnly    bool   `json:"readOnlyHint"`
	Destructive bool   `json:"destructiveHint"`
	Idempotent  bool   `json:"idempotentHint"`
	OpenWorld   bool   `json:"openWorldHint"`
}

type toolListing struct {
	Name         string      `json:"name"`
	Title        string      `json:"title,omitempty"`
	Description  string      `json:"description"`
	InputSchema  any         `json:"inputSchema"`
	OutputSchema any         `json:"outputSchema,omitempty"`
	Annotations  annotations `json:"annotations"`
}

type serverMeta struct {
	ServerInfo Implementation `json:"io.modelcontextprotocol/serverInfo"`
}

type completion struct {
	ResultType string      `json:"resultType,omitempty"`
	Meta       *serverMeta `json:"_meta,omitempty"`
}

type cacheHints struct {
	TTLMs      *int64 `json:"ttlMs,omitempty"`
	CacheScope string `json:"cacheScope,omitempty"`
}

type listResult struct {
	completion
	cacheHints
	Tools []toolListing `json:"tools"`
}

type discoverResult struct {
	completion
	cacheHints
	SupportedVersions []string     `json:"supportedVersions"`
	Capabilities      capabilities `json:"capabilities"`
	Instructions      string       `json:"instructions,omitempty"`
}

type requestMeta struct {
	Meta map[string]json.RawMessage `json:"_meta"`
}

type namedParams struct {
	Name string `json:"name"`
	URI  string `json:"uri"`
}

type versionRefusal struct {
	Supported []string `json:"supported"`
	Requested string   `json:"requested"`
}

type CallParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

type content struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type callResult struct {
	completion
	Content           []content `json:"content"`
	StructuredContent any       `json:"structuredContent,omitempty"`
	IsError           bool      `json:"isError"`
}

type cancelParams struct {
	RequestID json.RawMessage `json:"requestId"`
}

type callMeta struct {
	Meta struct {
		ProgressToken json.RawMessage `json:"progressToken"`
	} `json:"_meta"`
}

type notification struct {
	Version string `json:"jsonrpc"`
	Method  string `json:"method"`
	Params  any    `json:"params"`
}

type progressParams struct {
	ProgressToken json.RawMessage `json:"progressToken"`
	Progress      float64         `json:"progress"`
	Total         float64         `json:"total,omitempty"`
	Message       string          `json:"message,omitempty"`
}

type Empty struct{}

func isAbsent(raw json.RawMessage) bool {
	return len(raw) == 0 || bytes.Equal(raw, absentID)
}

func (m Message) isNotification() bool {
	return isAbsent(m.ID)
}

func negotiate(requested string) string {
	for _, supported := range ProtocolVersions {
		if supported == requested {
			return requested
		}
	}
	return ProtocolVersions[0]
}

func textContent(text string) content {
	return content{Type: contentText, Text: text}
}

func encode(value any) (string, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return "", err
	}
	return string(bytes.TrimSpace(buffer.Bytes())), nil
}
