package rpc

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	reflectionpb "google.golang.org/grpc/reflection/grpc_reflection_v1"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
)

const (
	reflectionV1      = "/grpc.reflection.v1.ServerReflection/ServerReflectionInfo"
	reflectionV1Alpha = "/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo"
	reflectionPackage = "grpc.reflection."
)

var bidirectional = &grpc.StreamDesc{ClientStreams: true, ServerStreams: true}

type reflector struct {
	stream grpc.ClientStream
	files  map[string]*descriptorpb.FileDescriptorProto
	absent map[string]bool
}

func (s *session) reflect(ctx context.Context, gather func(*reflector) error) (*protoregistry.Files, error) {
	files, err := s.reflectOver(ctx, reflectionV1, gather)
	if status.Code(err) == codes.Unimplemented {
		files, err = s.reflectOver(ctx, reflectionV1Alpha, gather)
	}
	if status.Code(err) == codes.Unimplemented {
		return nil, configError("the server does not offer reflection; add its .proto files instead")
	}
	return files, err
}

func (s *session) reflectOver(ctx context.Context, path string, gather func(*reflector) error) (*protoregistry.Files, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	stream, err := s.conn.NewStream(ctx, bidirectional, path)
	if err != nil {
		return nil, err
	}
	client := &reflector{stream: stream, files: map[string]*descriptorpb.FileDescriptorProto{}, absent: map[string]bool{}}
	if err := gather(client); err != nil {
		return nil, err
	}
	if err := client.fetchImports(); err != nil {
		return nil, err
	}
	return client.registry()
}

func (s *session) reflectService(ctx context.Context, service string) (*protoregistry.Files, error) {
	return s.reflect(ctx, func(client *reflector) error {
		err := client.fetch(fileContaining(service))
		var refused *refusal
		if errors.As(err, &refused) {
			return configError("service %q was not found on the server", service)
		}
		return err
	})
}

func (s *session) reflectAll(ctx context.Context) (*protoregistry.Files, error) {
	return s.reflect(ctx, func(client *reflector) error {
		services, err := client.listServices()
		if err != nil {
			return err
		}
		for _, service := range services {
			if strings.HasPrefix(service, reflectionPackage) {
				continue
			}
			if err := client.fetch(fileContaining(service)); err != nil {
				return err
			}
		}
		return nil
	})
}

func fileContaining(symbol string) *reflectionpb.ServerReflectionRequest {
	return &reflectionpb.ServerReflectionRequest{
		MessageRequest: &reflectionpb.ServerReflectionRequest_FileContainingSymbol{FileContainingSymbol: symbol},
	}
}

type refusal struct {
	message string
}

func (r *refusal) Error() string { return r.message }

func (r *reflector) exchange(request *reflectionpb.ServerReflectionRequest) (*reflectionpb.ServerReflectionResponse, error) {
	if err := r.stream.SendMsg(request); err != nil && !errors.Is(err, io.EOF) {
		return nil, err
	}
	response := &reflectionpb.ServerReflectionResponse{}
	if err := r.stream.RecvMsg(response); err != nil {
		if errors.Is(err, io.EOF) {
			return nil, fmt.Errorf("the server closed the reflection stream")
		}
		return nil, err
	}
	if refused := response.GetErrorResponse(); refused != nil {
		return nil, &refusal{"reflection failed: " + refused.GetErrorMessage()}
	}
	return response, nil
}

func (r *reflector) listServices() ([]string, error) {
	response, err := r.exchange(&reflectionpb.ServerReflectionRequest{
		MessageRequest: &reflectionpb.ServerReflectionRequest_ListServices{},
	})
	if err != nil {
		return nil, err
	}
	var names []string
	for _, service := range response.GetListServicesResponse().GetService() {
		names = append(names, service.GetName())
	}
	return names, nil
}

func (r *reflector) fetch(request *reflectionpb.ServerReflectionRequest) error {
	response, err := r.exchange(request)
	if err != nil {
		return err
	}
	for _, encoded := range response.GetFileDescriptorResponse().GetFileDescriptorProto() {
		file := &descriptorpb.FileDescriptorProto{}
		if err := proto.Unmarshal(encoded, file); err != nil {
			return fmt.Errorf("the server sent a descriptor that cannot be read: %w", err)
		}
		r.files[file.GetName()] = file
	}
	return nil
}

func (r *reflector) missingImports() []string {
	var missing []string
	for _, file := range r.files {
		for _, dependency := range file.GetDependency() {
			if r.files[dependency] == nil && !r.absent[dependency] {
				missing = append(missing, dependency)
			}
		}
	}
	return missing
}

func (r *reflector) fetchImports() error {
	for missing := r.missingImports(); len(missing) > 0; missing = r.missingImports() {
		for _, name := range missing {
			if err := r.fetchImport(name); err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *reflector) fetchImport(name string) error {
	err := r.fetch(&reflectionpb.ServerReflectionRequest{
		MessageRequest: &reflectionpb.ServerReflectionRequest_FileByFilename{FileByFilename: name},
	})
	var refused *refusal
	if errors.As(err, &refused) || (err == nil && r.files[name] == nil) {
		r.absent[name] = true
		return nil
	}
	return err
}

func (r *reflector) registry() (*protoregistry.Files, error) {
	set := &descriptorpb.FileDescriptorSet{}
	for _, file := range r.files {
		set.File = append(set.File, file)
	}
	files, err := protodesc.FileOptions{AllowUnresolvable: true}.NewFiles(set)
	if err != nil {
		return nil, fmt.Errorf("the server's descriptors cannot be used: %w", err)
	}
	return files, nil
}
