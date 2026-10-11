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

	codeParseError     = -32700
	codeInvalidRequest = -32600
	CodeMethodNotFound = -32601
	codeInvalidParams  = -32602

	contentText = "text"
)

var ProtocolVersions = []string{"2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"}

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
	ReadOnly bool `json:"readOnlyHint"`
}

type toolListing struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema any         `json:"inputSchema"`
	Annotations annotations `json:"annotations"`
}

type listResult struct {
	Tools []toolListing `json:"tools"`
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
	Content []content `json:"content"`
	IsError bool      `json:"isError"`
}

type cancelParams struct {
	RequestID json.RawMessage `json:"requestId"`
}

type Empty struct{}

func (m Message) isNotification() bool {
	return len(m.ID) == 0 || bytes.Equal(m.ID, absentID)
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
