package mcpclient

import (
	"context"
	"encoding/json"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mcp"
)

type listParams struct {
	Cursor string `json:"cursor,omitempty"`
}

type listedTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"inputSchema"`
}

type listPage struct {
	Tools      []listedTool `json:"tools"`
	NextCursor string       `json:"nextCursor"`
}

func Describe(ctx context.Context, target Target, policy engine.Policy) (Catalog, error) {
	ctx, cancel := context.WithTimeout(ctx, policy.Timeout(target.Options))
	defer cancel()

	catalog, err := describe(ctx, target, policy)
	if err != nil {
		return Catalog{}, classify(ctx, err)
	}
	return catalog, nil
}

func describe(ctx context.Context, target Target, policy engine.Policy) (Catalog, error) {
	session, err := open(target, policy)
	if err != nil {
		return Catalog{}, err
	}
	defer session.close()

	welcome, err := session.initialize(ctx)
	if err != nil {
		return Catalog{}, err
	}
	tools, err := session.tools(ctx)
	if err != nil {
		return Catalog{}, err
	}
	return Catalog{
		Server:          welcome.ServerInfo,
		ProtocolVersion: welcome.ProtocolVersion,
		Instructions:    welcome.Instructions,
		Tools:           tools,
	}, nil
}

const (
	maxToolPages    = 100
	maxTools        = 2000
	maxCatalogBytes = 8 << 20
)

func tooManyTools() error {
	return protocolError("the server lists more tools than can be loaded (at most %d, %d MB in total)", maxTools, maxCatalogBytes>>20)
}

func (s *session) tools(ctx context.Context) ([]Tool, error) {
	tools := []Tool{}
	cursor := ""
	perAnswer := s.limit
	remaining := int64(maxCatalogBytes)
	for page := 0; ; page++ {
		if page == maxToolPages || remaining <= 0 {
			return nil, tooManyTools()
		}
		s.limit = min(perAnswer, remaining)
		received, err := s.request(ctx, mcp.MethodListTools, listParams{Cursor: cursor})
		if err != nil {
			return nil, err
		}
		remaining -= int64(len(received.result))
		var listing listPage
		if err := json.Unmarshal(received.result, &listing); err != nil {
			return nil, protocolError("the tool list cannot be read: %v", err)
		}
		if len(tools)+len(listing.Tools) > maxTools {
			return nil, tooManyTools()
		}
		for _, listed := range listing.Tools {
			tools = append(tools, describeTool(listed))
		}
		if listing.NextCursor == "" {
			return tools, nil
		}
		cursor = listing.NextCursor
	}
}

func describeTool(listed listedTool) Tool {
	return Tool{
		Name:        listed.Name,
		Description: listed.Description,
		InputSchema: indented(listed.InputSchema),
		Skeleton:    skeleton(listed.InputSchema),
	}
}
