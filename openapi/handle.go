package openapi

import (
	"context"
	"fmt"
)

const (
	ActionSummary    = "summary"
	ActionCollection = "collection"
	ActionRequests   = "requests"
	ActionOperation  = "operation"
	ActionSchema     = "schema"
	ActionContract   = "contract"
)

type Query struct {
	Action string   `json:"action"`
	Source Source   `json:"source"`
	Offset int      `json:"offset"`
	Limit  int      `json:"limit"`
	Keys   []string `json:"keys"`
	Key    string   `json:"key"`
	Name   string   `json:"name"`
}

type Summary struct {
	Info       Info              `json:"info"`
	Version    string            `json:"version"`
	Hash       string            `json:"hash"`
	Servers    []Server          `json:"servers"`
	Tags       []Tag             `json:"tags"`
	Operations []Operation       `json:"operations"`
	Schemas    []string          `json:"schemas"`
	Security   []string          `json:"security"`
	Variables  map[string]string `json:"variables"`
	Warnings   []string          `json:"warnings"`
}

type Reply struct {
	Error      string      `json:"error,omitempty"`
	Summary    *Summary    `json:"summary,omitempty"`
	Collection *Collection `json:"collection,omitempty"`
	Detail     *Detail     `json:"detail,omitempty"`
	Schema     *SchemaNode `json:"schema,omitempty"`
	Contract   *Contract   `json:"contract,omitempty"`
}

func (d *Document) Summary() Summary {
	operations := make([]Operation, 0, len(d.ops))
	for _, op := range d.ops {
		d.GenerateRequest(op)
		operations = append(operations, *op)
	}
	return Summary{
		Info:       d.Info,
		Version:    d.Version,
		Hash:       d.Hash,
		Servers:    d.Servers,
		Tags:       d.Tags,
		Operations: operations,
		Schemas:    d.schemas,
		Security:   d.SecurityNames(),
		Variables:  d.Variables(),
		Warnings:   d.collectionWarnings(),
	}
}

func Handle(ctx context.Context, query Query, opt Options) Reply {
	doc, err := Load(ctx, query.Source, opt)
	if err != nil {
		return Reply{Error: err.Error()}
	}
	switch query.Action {
	case ActionSummary:
		summary := doc.Summary()
		return Reply{Summary: &summary}
	case ActionCollection:
		collection := doc.Generate(Selection{Offset: query.Offset, Limit: query.Limit})
		return Reply{Collection: &collection}
	case ActionRequests:
		collection := doc.Generate(Selection{Keys: query.Keys})
		return Reply{Collection: &collection}
	case ActionOperation:
		op, ok := doc.Lookup(query.Key)
		if !ok {
			return Reply{Error: fmt.Sprintf("the spec has no operation %q", query.Key)}
		}
		detail := doc.Detail(op)
		return Reply{Detail: &detail}
	case ActionSchema:
		schema, err := doc.Schema(query.Name)
		if err != nil {
			return Reply{Error: err.Error()}
		}
		return Reply{Schema: schema}
	case ActionContract:
		contract := doc.Contract()
		return Reply{Contract: &contract}
	}
	return Reply{Error: fmt.Sprintf("unknown action %q", query.Action)}
}
