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
	"github.com/kunalgoesbyken/gostman/locales"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
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
	aliases, err := importAliases(sources)
	if err != nil {
		return nil, err
	}
	compiler := protocompile.Compiler{
		Resolver: protocompile.WithStandardImports(protocompile.CompositeResolver{
			&protocompile.SourceResolver{Accessor: protocompile.SourceAccessorFromMap(sources)},
			forwardingResolver(aliases),
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

func importsByFile(sources map[string]string) map[string][]string {
	imports := make(map[string][]string, len(sources))
	for name, content := range sources {
		tree, err := parser.Parse(name, strings.NewReader(content), reporter.NewHandler(nil))
		if err != nil {
			continue
		}
		for _, declaration := range tree.Decls {
			if statement, ok := declaration.(*ast.ImportNode); ok {
				imports[name] = append(imports[name], statement.Name.AsString())
			}
		}
	}
	return imports
}

func importAliases(sources map[string]string) (map[string]string, error) {
	imports := importsByFile(sources)
	names := sortedNames(sources)
	aliases := map[string]string{}
	for _, importer := range names {
		for _, imported := range imports[importer] {
			if file, found := sameNamedFile(sources, imported); found {
				aliases[imported] = file
			}
		}
	}
	graph := make(map[string][]string, len(sources))
	for importer, paths := range imports {
		for _, imported := range paths {
			if file, found := suppliedFile(sources, aliases, imported); found {
				graph[importer] = append(graph[importer], file)
			}
		}
	}
	for _, importer := range names {
		for _, imported := range imports[importer] {
			file, aliased := aliases[imported]
			if aliased && leadsTo(graph, file, importer, map[string]bool{}) {
				return nil, localizedConfigError(locales.EngineGrpcImportConflict, locales.Params{
					"importer": importer,
					"path":     imported,
					"file":     file,
				})
			}
		}
	}
	return aliases, nil
}

func suppliedFile(sources, aliases map[string]string, imported string) (string, bool) {
	if _, exact := sources[imported]; exact {
		return imported, true
	}
	file, aliased := aliases[imported]
	return file, aliased
}

func sameNamedFile(sources map[string]string, imported string) (string, bool) {
	if _, exact := sources[imported]; exact {
		return "", false
	}
	var candidates []string
	for name := range sources {
		if path.Base(name) == path.Base(imported) {
			candidates = append(candidates, name)
		}
	}
	if len(candidates) != 1 {
		return "", false
	}
	return candidates[0], true
}

func leadsTo(graph map[string][]string, from, to string, visited map[string]bool) bool {
	if from == to {
		return true
	}
	if visited[from] {
		return false
	}
	visited[from] = true
	for _, next := range graph[from] {
		if leadsTo(graph, next, to, visited) {
			return true
		}
	}
	return false
}

func forwardingResolver(aliases map[string]string) protocompile.Resolver {
	return protocompile.ResolverFunc(func(name string) (protocompile.SearchResult, error) {
		file, aliased := aliases[name]
		if !aliased {
			return protocompile.SearchResult{}, protoregistry.NotFound
		}
		return protocompile.SearchResult{Proto: &descriptorpb.FileDescriptorProto{
			Name:             &name,
			Dependency:       []string{file},
			PublicDependency: []int32{0},
		}}, nil
	})
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
