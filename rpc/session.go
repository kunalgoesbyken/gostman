package rpc

import (
	"context"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
)

const binaryKeySuffix = "-bin"

type session struct {
	conn      *connection
	expansion *engine.Expansion
	metadata  metadata.MD
	protos    []ProtoFile
}

func open(target Target, policy engine.Policy) (*session, error) {
	expansion, err := engine.NewExpansion(target.Variables)
	if err != nil {
		return nil, configError("%v", err)
	}
	address, err := parseEndpoint(expansion.Text(target.Address))
	if err != nil {
		return nil, err
	}
	rows, auth, err := engine.Inherit(target.Headers, target.Auth, target.Inherited)
	if err != nil {
		return nil, configError("%v", err)
	}
	headers, err := expansion.Headers(rows, auth)
	if err != nil {
		return nil, configError("%v", err)
	}
	outgoing, err := toMetadata(headers)
	if err != nil {
		return nil, err
	}
	if err := expansion.Err(); err != nil {
		return nil, configError("%v", err)
	}
	conn, err := dial(address, target.Options, policy)
	if err != nil {
		return nil, err
	}
	return &session{conn: conn, expansion: expansion, metadata: outgoing, protos: target.Protos}, nil
}

func (s *session) close() {
	s.conn.Close()
}

func (s *session) connect(ctx context.Context) (context.Context, error) {
	if err := s.conn.ready(ctx); err != nil {
		return nil, err
	}
	return metadata.NewOutgoingContext(ctx, s.metadata), nil
}

func (s *session) files(ctx context.Context, service string) (*protoregistry.Files, error) {
	if len(s.protos) > 0 {
		return compile(ctx, s.protos)
	}
	return s.reflectService(ctx, service)
}

func (s *session) method(ctx context.Context, name string) (protoreflect.MethodDescriptor, *protoregistry.Files, error) {
	service, method, found := strings.Cut(strings.TrimPrefix(strings.TrimSpace(name), "/"), "/")
	if !found || service == "" || method == "" {
		return nil, nil, configError("choose a method to call, such as package.Service/Method")
	}
	files, err := s.files(ctx, service)
	if err != nil {
		return nil, nil, err
	}
	descriptor, err := files.FindDescriptorByName(protoreflect.FullName(service))
	if err != nil {
		return nil, nil, configError("service %q was not found", service)
	}
	described, ok := descriptor.(protoreflect.ServiceDescriptor)
	if !ok {
		return nil, nil, configError("%q is not a service", service)
	}
	target := described.Methods().ByName(protoreflect.Name(method))
	if target == nil {
		return nil, nil, configError("service %q has no method %q", service, method)
	}
	return target, files, nil
}

func toMetadata(headers []engine.HeaderEntry) (metadata.MD, error) {
	outgoing := metadata.MD{}
	for _, header := range headers {
		key := strings.ToLower(strings.TrimSpace(header.Key))
		if !isMetadataKey(key) {
			return nil, configError("header %q cannot be sent as gRPC metadata; use letters, digits, '-', '_' and '.'", header.Key)
		}
		if !strings.HasSuffix(key, binaryKeySuffix) && !isPrintableASCII(header.Value) {
			return nil, configError("the value of header %q has characters gRPC metadata cannot carry", header.Key)
		}
		outgoing.Append(key, header.Value)
	}
	return outgoing, nil
}

func isMetadataKey(key string) bool {
	if key == "" {
		return false
	}
	for _, char := range key {
		isLetter := char >= 'a' && char <= 'z'
		isDigit := char >= '0' && char <= '9'
		if !isLetter && !isDigit && char != '-' && char != '_' && char != '.' {
			return false
		}
	}
	return true
}

func isPrintableASCII(value string) bool {
	for _, char := range value {
		if char < 0x20 || char > 0x7E {
			return false
		}
	}
	return true
}
