package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/mcp"
	"github.com/krockxz/gostman/redact"
	"github.com/krockxz/gostman/runner"
	"github.com/krockxz/gostman/workspace"
)

type Settings struct {
	Root         string
	Environment  string
	Variables    map[string]string
	Policy       engine.Policy
	AllowedHosts []string
}

type Desk struct {
	mu      sync.Mutex
	files   *workspace.Workspace
	client  *Client
	startup map[string]string
	mocking mocking
	reach   *destinations
}

type scene struct {
	files  workspace.Collection
	stored runner.Collection
}

type attached interface {
	Attachment() string
}

func Open(settings Settings) (*Desk, error) {
	state, err := workspace.Inspect(settings.Root)
	if err != nil {
		return nil, err
	}
	if state != workspace.Existing {
		return nil, fmt.Errorf("%s is not a Gostman workspace; create one with \"gostman init\"", settings.Root)
	}
	files, err := workspace.Open(settings.Root)
	if err != nil {
		return nil, err
	}
	reach := newDestinations(settings.AllowedHosts)
	reach.learn(files.Collection(), settings.Variables)
	policy := settings.Policy
	policy.Permit = reach.permit
	client, err := NewClient(policy)
	if err != nil {
		return nil, err
	}
	desk := &Desk{files: files, client: client, startup: settings.Variables, reach: reach}
	stored, err := runner.FromWorkspace(files.Collection())
	if err != nil {
		return nil, err
	}
	return desk, client.Enter(stored, settings.Environment, settings.Variables)
}

func (d *Desk) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.mocking.stop()
}

func (d *Desk) refresh() (scene, error) {
	if err := d.files.Reload(); err != nil {
		return scene{}, err
	}
	files := d.files.Collection()
	d.reach.learn(files, d.startup)
	stored, err := runner.FromWorkspace(files)
	if err != nil {
		return scene{}, err
	}
	return scene{files: files, stored: stored}, d.client.Study(stored)
}

func decodeStrict(raw json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func attachmentOf(value any) string {
	if carrier, ok := value.(attached); ok {
		return carrier.Attachment()
	}
	return ""
}

func answer[A, R any](d *Desk, ctx context.Context, arguments A, handle func(*Desk, context.Context, scene, A) (R, error)) (mcp.Result, error) {
	current, err := d.refresh()
	if err != nil {
		return mcp.Result{}, err
	}
	value, err := handle(d, ctx, current, arguments)
	if err != nil {
		return mcp.Result{}, err
	}
	cleaned, err := redact.Clean(d.client.guard, value)
	if err != nil {
		return mcp.Result{}, err
	}
	return mcp.Result{Value: cleaned, Text: d.client.Text(attachmentOf(value))}, nil
}

func bind[A, R any](d *Desk, handle func(*Desk, context.Context, scene, A) (R, error)) func(context.Context, json.RawMessage) (mcp.Result, error) {
	return func(ctx context.Context, raw json.RawMessage) (mcp.Result, error) {
		var arguments A
		if err := decodeStrict(raw, &arguments); err != nil {
			return mcp.Result{}, fmt.Errorf("The arguments do not match this tool's input schema: %s", err)
		}
		d.mu.Lock()
		defer d.mu.Unlock()
		result, err := answer(d, ctx, arguments, handle)
		if err != nil {
			return mcp.Result{}, errors.New(d.client.Text(err.Error()))
		}
		return result, nil
	}
}
