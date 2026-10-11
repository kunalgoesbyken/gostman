package rpc

import "github.com/krockxz/gostman/engine"

const (
	Protocol = "grpc"

	SourceReflection = "reflection"
	SourceProto      = "proto"
)

type ProtoFile struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type Target struct {
	Address   string         `json:"address"`
	Headers   string         `json:"headers"`
	Auth      engine.Auth    `json:"auth"`
	Variables string         `json:"variables"`
	Options   engine.Options `json:"options"`
	Protos    []ProtoFile    `json:"protos"`
}

type Call struct {
	Target  Target `json:"target"`
	Method  string `json:"method"`
	Message string `json:"message"`
}

type Method struct {
	Name            string `json:"name"`
	FullName        string `json:"fullName"`
	InputType       string `json:"inputType"`
	OutputType      string `json:"outputType"`
	ClientStreaming bool   `json:"clientStreaming"`
	ServerStreaming bool   `json:"serverStreaming"`
	Skeleton        string `json:"skeleton"`
}

type Service struct {
	Name    string   `json:"name"`
	Methods []Method `json:"methods"`
}

type Schema struct {
	Source   string    `json:"source"`
	Services []Service `json:"services"`
}
