package mcpclient

import (
	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mcp"
)

const Protocol = "mcp"

type Target struct {
	URL       string         `json:"url"`
	Headers   string         `json:"headers"`
	Inherited []engine.Layer `json:"inherited,omitempty"`
	Auth      engine.Auth    `json:"auth"`
	Variables string         `json:"variables"`
	Options   engine.Options `json:"options"`
}

type Call struct {
	Target    Target `json:"target"`
	Method    string `json:"method"`
	Name      string `json:"tool"`
	Arguments string `json:"arguments"`
}

type Tool struct {
	Name         string `json:"name"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	InputSchema  string `json:"inputSchema"`
	OutputSchema string `json:"outputSchema"`
	Skeleton     string `json:"skeleton"`
	Fingerprint  string `json:"fingerprint"`
}

type Resource struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Title       string `json:"title"`
	Description string `json:"description"`
	MimeType    string `json:"mimeType"`
}

type ResourceTemplate struct {
	URITemplate string `json:"uriTemplate"`
	Name        string `json:"name"`
	Title       string `json:"title"`
	Description string `json:"description"`
	MimeType    string `json:"mimeType"`
}

type PromptArgument struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

type Prompt struct {
	Name        string           `json:"name"`
	Title       string           `json:"title"`
	Description string           `json:"description"`
	Arguments   []PromptArgument `json:"arguments"`
	Skeleton    string           `json:"skeleton"`
}

type Problem struct {
	Method  string `json:"method"`
	Message string `json:"message"`
}

type Rejection struct {
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

type Catalog struct {
	Server            mcp.Implementation `json:"server"`
	ProtocolVersion   string             `json:"protocolVersion"`
	Legacy            bool               `json:"legacy"`
	Instructions      string             `json:"instructions"`
	ServerKey         string             `json:"serverKey"`
	Tools             []Tool             `json:"tools"`
	Resources         []Resource         `json:"resources"`
	ResourceTemplates []ResourceTemplate `json:"resourceTemplates"`
	Prompts           []Prompt           `json:"prompts"`
	Problems          []Problem          `json:"problems"`
	Rejected          []Rejection        `json:"rejected"`
}
