package mcpclient

import (
	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/mcp"
)

const Protocol = "mcp"

type Target struct {
	URL       string         `json:"url"`
	Headers   string         `json:"headers"`
	Auth      engine.Auth    `json:"auth"`
	Variables string         `json:"variables"`
	Options   engine.Options `json:"options"`
}

type Call struct {
	Target    Target `json:"target"`
	Tool      string `json:"tool"`
	Arguments string `json:"arguments"`
}

type Tool struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	InputSchema string `json:"inputSchema"`
	Skeleton    string `json:"skeleton"`
}

type Catalog struct {
	Server          mcp.Implementation `json:"server"`
	ProtocolVersion string             `json:"protocolVersion"`
	Instructions    string             `json:"instructions"`
	Tools           []Tool             `json:"tools"`
}
