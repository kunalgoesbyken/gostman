package rpc

import (
	"bytes"
	"context"
	"encoding/json"
	"sort"

	"github.com/krockxz/gostman/engine"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/dynamicpb"
)

const emptyMessage = "{}"

func Describe(ctx context.Context, target Target, policy engine.Policy) (Schema, error) {
	ctx, cancel := context.WithTimeout(ctx, policy.Timeout(target.Options))
	defer cancel()

	schema, err := describe(ctx, target, policy)
	if err != nil {
		return Schema{}, classify(ctx, err)
	}
	return schema, nil
}

func describe(ctx context.Context, target Target, policy engine.Policy) (Schema, error) {
	if len(target.Protos) > 0 {
		files, err := compile(ctx, target.Protos)
		if err != nil {
			return Schema{}, err
		}
		return Schema{Source: SourceProto, Services: describeServices(files)}, nil
	}

	session, err := open(target, policy)
	if err != nil {
		return Schema{}, err
	}
	defer session.close()

	ctx, err = session.connect(ctx)
	if err != nil {
		return Schema{}, err
	}
	files, err := session.reflectAll(ctx)
	if err != nil {
		return Schema{}, err
	}
	return Schema{Source: SourceReflection, Services: describeServices(files)}, nil
}

func describeServices(files *protoregistry.Files) []Service {
	services := []Service{}
	files.RangeFiles(func(file protoreflect.FileDescriptor) bool {
		declared := file.Services()
		for i := 0; i < declared.Len(); i++ {
			services = append(services, describeService(declared.Get(i)))
		}
		return true
	})
	sort.Slice(services, func(i, j int) bool { return services[i].Name < services[j].Name })
	return services
}

func describeService(service protoreflect.ServiceDescriptor) Service {
	described := Service{Name: string(service.FullName()), Methods: []Method{}}
	methods := service.Methods()
	for i := 0; i < methods.Len(); i++ {
		method := methods.Get(i)
		described.Methods = append(described.Methods, Method{
			Name:            string(method.Name()),
			FullName:        described.Name + "/" + string(method.Name()),
			InputType:       string(method.Input().FullName()),
			OutputType:      string(method.Output().FullName()),
			ClientStreaming: method.IsStreamingClient(),
			ServerStreaming: method.IsStreamingServer(),
			Skeleton:        skeleton(method.Input()),
		})
	}
	return described
}

func skeleton(descriptor protoreflect.MessageDescriptor) string {
	message := dynamicpb.NewMessage(descriptor)
	populate(message, map[protoreflect.FullName]bool{})

	encoded, err := protojson.MarshalOptions{EmitUnpopulated: true, AllowPartial: true}.Marshal(message)
	if err != nil {
		return emptyMessage
	}
	var indented bytes.Buffer
	if err := json.Indent(&indented, encoded, "", "  "); err != nil {
		return emptyMessage
	}
	return indented.String()
}

func populate(message protoreflect.Message, ancestors map[protoreflect.FullName]bool) {
	name := message.Descriptor().FullName()
	ancestors[name] = true
	defer delete(ancestors, name)

	fields := message.Descriptor().Fields()
	for i := 0; i < fields.Len(); i++ {
		field := fields.Get(i)
		if !isFirstOfOneof(field) {
			continue
		}
		switch {
		case field.IsMap():
		case field.IsList():
			if canExpand(field, ancestors) {
				list := message.Mutable(field).List()
				element := list.NewElement()
				populate(element.Message(), ancestors)
				list.Append(element)
			}
		case field.Message() != nil:
			if canExpand(field, ancestors) {
				populate(message.Mutable(field).Message(), ancestors)
			}
		case field.HasPresence():
			message.Set(field, message.Get(field))
		}
	}
}

func canExpand(field protoreflect.FieldDescriptor, ancestors map[protoreflect.FullName]bool) bool {
	nested := field.Message()
	return nested != nil && !nested.IsPlaceholder() && !ancestors[nested.FullName()]
}

func isFirstOfOneof(field protoreflect.FieldDescriptor) bool {
	oneof := field.ContainingOneof()
	return oneof == nil || oneof.Fields().Get(0).Number() == field.Number()
}
