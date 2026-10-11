package mcp

import (
	"bytes"
	"encoding/json"
)

const (
	jsonrpcVersion = "2.0"

	methodInitialize = "initialize"
	methodPing       = "ping"
	methodListTools  = "tools/list"
	methodCallTool   = "tools/call"
	methodCancelled  = "notifications/cancelled"

	codeParseError     = -32700
	codeInvalidRequest = -32600
	codeMethodNotFound = -32601
	codeInvalidParams  = -32602

	contentText = "text"
)

var protocolVersions = []string{"2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"}

var absentID = json.RawMessage("null")

type message struct {
	Version string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type failure struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type reply struct {
	Version string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *failure        `json:"error,omitempty"`
}

type initializeParams struct {
	ProtocolVersion string `json:"protocolVersion"`
}

type implementation struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type toolCapability struct{}

type capabilities struct {
	Tools toolCapability `json:"tools"`
}

type initializeResult struct {
	ProtocolVersion string         `json:"protocolVersion"`
	Capabilities    capabilities   `json:"capabilities"`
	ServerInfo      implementation `json:"serverInfo"`
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

type callParams struct {
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

type empty struct{}

func (m message) isNotification() bool {
	return len(m.ID) == 0 || bytes.Equal(m.ID, absentID)
}

func negotiate(requested string) string {
	for _, supported := range protocolVersions {
		if supported == requested {
			return requested
		}
	}
	return protocolVersions[0]
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
