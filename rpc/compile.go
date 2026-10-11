package rpc

import (
	"context"
	"path"
	"sort"
	"strings"

	"github.com/bufbuild/protocompile"
	"github.com/bufbuild/protocompile/ast"
	"github.com/bufbuild/protocompile/parser"
	"github.com/bufbuild/protocompile/reporter"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
)

const (
	maxProtoFiles = 200
	maxProtoBytes = 4 << 20
)

func compile(ctx context.Context, protos []ProtoFile) (*protoregistry.Files, error) {
	sources, err := namedSources(protos)
	if err != nil {
		return nil, err
	}
	compiler := protocompile.Compiler{
		Resolver: protocompile.WithStandardImports(&protocompile.SourceResolver{
			Accessor: protocompile.SourceAccessorFromMap(sources),
		}),
	}
	compiled, err := compiler.Compile(ctx, sortedNames(sources)...)
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, configError("the .proto files do not compile: %v", err)
	}

	files := &protoregistry.Files{}
	for _, file := range compiled {
		if err := register(files, file); err != nil {
			return nil, configError("the .proto files conflict: %v", err)
		}
	}
	return files, nil
}

func namedSources(protos []ProtoFile) (map[string]string, error) {
	if len(protos) > maxProtoFiles {
		return nil, configError("add at most %d .proto files", maxProtoFiles)
	}
	size := 0
	sources := make(map[string]string, len(protos))
	for _, proto := range protos {
		if size += len(proto.Content); size > maxProtoBytes {
			return nil, configError("the .proto files are larger than %d MB together", maxProtoBytes>>20)
		}
		name := cleanFileName(proto.Name)
		if name == "" {
			return nil, configError("every .proto file needs a name")
		}
		if _, exists := sources[name]; exists {
			return nil, configError("%q was added more than once", name)
		}
		sources[name] = proto.Content
	}
	for _, imported := range importedPaths(sources) {
		adoptImportPath(sources, imported)
	}
	return sources, nil
}

func cleanFileName(name string) string {
	return strings.TrimLeft(path.Clean(strings.ReplaceAll(strings.TrimSpace(name), `\`, "/")), "./")
}

func sortedNames(sources map[string]string) []string {
	names := make([]string, 0, len(sources))
	for name := range sources {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func importedPaths(sources map[string]string) []string {
	var imported []string
	for _, name := range sortedNames(sources) {
		tree, err := parser.Parse(name, strings.NewReader(sources[name]), reporter.NewHandler(nil))
		if err != nil {
			continue
		}
		for _, declaration := range tree.Decls {
			if statement, ok := declaration.(*ast.ImportNode); ok {
				imported = append(imported, statement.Name.AsString())
			}
		}
	}
	return imported
}

func adoptImportPath(sources map[string]string, imported string) {
	if _, exists := sources[imported]; exists {
		return
	}
	var candidates []string
	for name := range sources {
		if path.Base(name) == path.Base(imported) {
			candidates = append(candidates, name)
		}
	}
	if len(candidates) != 1 {
		return
	}
	sources[imported] = sources[candidates[0]]
	delete(sources, candidates[0])
}

func register(files *protoregistry.Files, file protoreflect.FileDescriptor) error {
	if _, err := files.FindFileByPath(file.Path()); err == nil {
		return nil
	}
	imports := file.Imports()
	for i := 0; i < imports.Len(); i++ {
		if err := register(files, imports.Get(i).FileDescriptor); err != nil {
			return err
		}
	}
	return files.RegisterFile(file)
}
