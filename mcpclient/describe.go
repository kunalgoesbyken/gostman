package mcpclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	maxListPages    = 100
	maxListItems    = 2000
	maxCatalogBytes = 8 << 20
)

type listParams struct {
	Cursor string `json:"cursor,omitempty"`
}

type listedTool struct {
	Name        string          `json:"name"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"inputSchema"`
}

type listedPrompt struct {
	Name        string           `json:"name"`
	Title       string           `json:"title"`
	Description string           `json:"description"`
	Arguments   []PromptArgument `json:"arguments"`
}

type lister struct {
	session   *session
	perAnswer int64
	remaining int64
}

func newLister(s *session) *lister {
	return &lister{session: s, perAnswer: s.limit, remaining: maxCatalogBytes}
}

func tooManyItems(method string) error {
	return protocolError("the server's %s answer is longer than can be loaded (at most %d items, %d MB in total)", method, maxListItems, maxCatalogBytes>>20)
}

func listAll[T any](ctx context.Context, l *lister, method string) ([]T, answer, error) {
	s := l.session
	key := listKeys[method]
	defer func() { s.limit = l.perAnswer }()
	items := []T{}
	cursor := ""
	for page := 0; ; page++ {
		if page == maxListPages || l.remaining <= 0 {
			return nil, answer{}, tooManyItems(method)
		}
		s.limit = min(l.perAnswer, l.remaining)
		received, err := s.request(ctx, method, listParams{Cursor: cursor})
		if err != nil {
			return nil, answer{}, err
		}
		l.remaining -= int64(len(received.result))
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(received.result, &fields); err != nil {
			return nil, answer{}, protocolError("the %s result cannot be read: %v", method, err)
		}
		var listed []T
		if raw, present := fields[key]; present {
			if err := json.Unmarshal(raw, &listed); err != nil {
				return nil, answer{}, protocolError("the %s result cannot be read: %v", method, err)
			}
		}
		if len(items)+len(listed) > maxListItems {
			return nil, answer{}, tooManyItems(method)
		}
		items = append(items, listed...)
		var next string
		json.Unmarshal(fields["nextCursor"], &next)
		if next == "" {
			return items, received, nil
		}
		cursor = next
	}
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
	session, err := open(ctx, target, policy)
	if err != nil {
		return Catalog{}, err
	}
	defer session.close()

	if err := session.connect(ctx); err != nil {
		return Catalog{}, err
	}
	catalog := Catalog{
		Server:            session.server.Server,
		ProtocolVersion:   session.version,
		Legacy:            !session.modern,
		Instructions:      session.server.Instructions,
		ServerKey:         serverKey(session.address),
		Tools:             []Tool{},
		Resources:         []Resource{},
		ResourceTemplates: []ResourceTemplate{},
		Prompts:           []Prompt{},
		Problems:          []Problem{},
		Rejected:          []Rejection{},
	}
	return catalog, session.fill(ctx, &catalog)
}

func (s *session) fill(ctx context.Context, catalog *Catalog) error {
	l := newLister(s)
	if s.server.offers(capabilityTools) || len(s.server.Capabilities) == 0 {
		tools, _, err := listAll[listedTool](ctx, l, MethodListTools)
		if err := catalog.note(MethodListTools, err); err != nil {
			return err
		}
		for _, listed := range tools {
			catalog.addTool(listed, s.mirrorsHeaders())
		}
	}
	if s.server.offers(capabilityResources) {
		resources, _, err := listAll[Resource](ctx, l, MethodListResources)
		if err := catalog.note(MethodListResources, err); err != nil {
			return err
		}
		templates, _, err := listAll[ResourceTemplate](ctx, l, MethodListTemplates)
		if err := catalog.note(MethodListTemplates, err); err != nil {
			return err
		}
		catalog.Resources = append(catalog.Resources, resources...)
		catalog.ResourceTemplates = append(catalog.ResourceTemplates, templates...)
	}
	if s.server.offers(capabilityPrompts) {
		prompts, _, err := listAll[listedPrompt](ctx, l, MethodListPrompts)
		if err := catalog.note(MethodListPrompts, err); err != nil {
			return err
		}
		for _, listed := range prompts {
			catalog.Prompts = append(catalog.Prompts, describePrompt(listed))
		}
	}
	return nil
}

func (c *Catalog) note(method string, err error) error {
	var refused *refusal
	if !errors.As(err, &refused) {
		return err
	}
	c.Problems = append(c.Problems, Problem{Method: method, Message: fmt.Sprintf("error %d: %s", refused.reason.Code, refused.reason.Message)})
	return nil
}

func (c *Catalog) addTool(listed listedTool, mirrorsHeaders bool) {
	if mirrorsHeaders {
		if reason := checkHeaderAnnotations(listed.InputSchema); reason != "" {
			c.Rejected = append(c.Rejected, Rejection{Name: listed.Name, Reason: reason})
			return
		}
	}
	c.Tools = append(c.Tools, Tool{
		Name:        listed.Name,
		Title:       listed.Title,
		Description: listed.Description,
		InputSchema: indented(listed.InputSchema),
		Skeleton:    skeleton(listed.InputSchema),
		Fingerprint: toolFingerprint(listed),
	})
}

func describePrompt(listed listedPrompt) Prompt {
	arguments := listed.Arguments
	if arguments == nil {
		arguments = []PromptArgument{}
	}
	return Prompt{
		Name:        listed.Name,
		Title:       listed.Title,
		Description: listed.Description,
		Arguments:   arguments,
		Skeleton:    promptSkeleton(arguments),
	}
}
