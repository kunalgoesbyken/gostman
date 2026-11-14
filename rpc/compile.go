package rpc

import (
	"context"
	"errors"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/bufbuild/protocompile"
	"github.com/bufbuild/protocompile/ast"
	"github.com/bufbuild/protocompile/parser"
	"github.com/bufbuild/protocompile/reporter"
	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
)

const (
	maxProtoFiles = 200
	maxProtoBytes = 4 << 20

	wellKnownFolder     = "google/protobuf/"
	descriptorProtoPath = wellKnownFolder + "descriptor.proto"
)

func compile(ctx context.Context, protos []ProtoFile) (*protoregistry.Files, error) {
	return compileTarget(ctx, protos, nil, engine.Policy{})
}

func compileTarget(ctx context.Context, protos []ProtoFile, roots []string, policy engine.Policy) (*protoregistry.Files, error) {
	sources, err := namedSources(protos)
	if err != nil {
		return nil, err
	}
	if len(roots) > 0 && policy.ReadFile == nil && policy.RequireImportRootAccess {
		return nil, localizedConfigError(locales.EngineGrpcImportRootsDenied, nil)
	}
	var rootResolver protocompile.Resolver
	if len(roots) > 0 && policy.ReadFile != nil {
		rootResolver, err = importRootResolver(roots, policy, len(sources), sourceBytes(sources))
		if err != nil {
			return nil, err
		}
	}
	aliases, err := importAliases(ctx, sources, rootResolver)
	if err != nil {
		return nil, err
	}
	placeDescriptorProto(sources, aliases)
	resolvers := protocompile.CompositeResolver{&protocompile.SourceResolver{Accessor: protocompile.SourceAccessorFromMap(sources)}}
	if rootResolver != nil {
		resolvers = append(resolvers, rootResolver)
	}
	resolvers = append(resolvers, forwardingResolver(aliases))
	compiler := protocompile.Compiler{Resolver: protocompile.WithStandardImports(resolvers)}
	compiled, err := compiler.Compile(ctx, sortedNames(sources)...)
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if len(roots) > 0 && policy.ReadFile == nil && strings.Contains(err.Error(), "could not resolve path") {
			return nil, configError("the .proto files do not compile: %v. %s", err, locales.New(locales.EngineGrpcImportRootsUnavailable, nil).String())
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

type parsedFile struct {
	imports []string
	pkg     string
}

func parseFiles(ctx context.Context, sources map[string]string) (map[string]parsedFile, error) {
	parsed := make(map[string]parsedFile, len(sources))
	for name, content := range sources {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		tree, err := parser.Parse(name, strings.NewReader(content), reporter.NewHandler(nil))
		if err != nil {
			continue
		}
		var file parsedFile
		seen := map[string]bool{}
		for _, declaration := range tree.Decls {
			switch statement := declaration.(type) {
			case *ast.ImportNode:
				if imported := statement.Name.AsString(); !seen[imported] {
					seen[imported] = true
					file.imports = append(file.imports, imported)
				}
			case *ast.PackageNode:
				file.pkg = string(statement.Name.AsIdentifier())
			}
		}
		parsed[name] = file
	}
	return parsed, nil
}

func importAliases(ctx context.Context, sources map[string]string, roots protocompile.Resolver) (map[string]string, error) {
	parsed, err := parseFiles(ctx, sources)
	if err != nil {
		return nil, err
	}
	names := sortedNames(sources)
	byBase := map[string][]string{}
	for _, name := range names {
		byBase[path.Base(name)] = append(byBase[path.Base(name)], name)
	}
	aliases := map[string]string{}
	for _, importer := range names {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		for _, imported := range parsed[importer].imports {
			if _, exact := sources[imported]; exact {
				continue
			}
			if roots != nil {
				if _, err := roots.FindFileByPath(imported); err == nil {
					continue
				} else if !errors.Is(err, os.ErrNotExist) {
					return nil, err
				}
			}
			if file, found := sameNamedFile(byBase, parsed, imported); found {
				aliases[imported] = file
			}
		}
	}
	graph := make(map[string][]string, len(sources))
	for importer, file := range parsed {
		for _, imported := range file.imports {
			if target, found := suppliedFile(sources, aliases, imported); found {
				graph[importer] = append(graph[importer], target)
			}
		}
	}
	reached := map[string]map[string]bool{}
	for _, importer := range names {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		for _, imported := range parsed[importer].imports {
			file, aliased := aliases[imported]
			if !aliased {
				continue
			}
			if reached[file] == nil {
				reached[file] = reachableFrom(graph, file)
			}
			if reached[file][importer] {
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

func placeDescriptorProto(sources, aliases map[string]string) {
	file, aliased := aliases[descriptorProtoPath]
	if !aliased {
		return
	}
	sources[descriptorProtoPath] = sources[file]
	delete(sources, file)
	delete(aliases, descriptorProtoPath)
	for path, target := range aliases {
		if target == file {
			aliases[path] = descriptorProtoPath
		}
	}
	aliases[file] = descriptorProtoPath
}

func suppliedFile(sources, aliases map[string]string, imported string) (string, bool) {
	if _, exact := sources[imported]; exact {
		return imported, true
	}
	file, aliased := aliases[imported]
	return file, aliased
}

func sameNamedFile(byBase map[string][]string, parsed map[string]parsedFile, imported string) (string, bool) {
	candidates := byBase[path.Base(imported)]
	if len(candidates) != 1 {
		return "", false
	}
	if strings.HasPrefix(imported, wellKnownFolder) && parsed[candidates[0]].pkg != packageOfFolder(imported) {
		return "", false
	}
	return candidates[0], true
}

func packageOfFolder(imported string) string {
	return strings.ReplaceAll(path.Dir(imported), "/", ".")
}

func reachableFrom(graph map[string][]string, start string) map[string]bool {
	reached := map[string]bool{start: true}
	pending := []string{start}
	for len(pending) > 0 {
		current := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		for _, next := range graph[current] {
			if !reached[next] {
				reached[next] = true
				pending = append(pending, next)
			}
		}
	}
	return reached
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

func sourceBytes(sources map[string]string) int {
	total := 0
	for _, content := range sources {
		total += len(content)
	}
	return total
}

func importRootResolver(roots []string, policy engine.Policy, count, size int) (protocompile.Resolver, error) {
	if policy.ReadFile == nil {
		return nil, localizedConfigError(locales.EngineGrpcImportRootsDenied, nil)
	}
	normalized := make([]string, len(roots))
	for index, root := range roots {
		root = strings.ReplaceAll(root, "\\", "/")
		if !safeImportRoot(root, policy.AllowAbsoluteImportRoots) {
			return nil, localizedConfigError(locales.EngineGrpcImportRootsUnsafe, locales.Params{"path": roots[index]})
		}
		normalized[index] = filepath.FromSlash(root)
	}
	var mu sync.Mutex
	cache := map[string][]byte{}
	return protocompile.ResolverFunc(func(name string) (protocompile.SearchResult, error) {
		if !safeImportPath(name) {
			return protocompile.SearchResult{}, os.ErrNotExist
		}
		mu.Lock()
		defer mu.Unlock()
		for _, root := range normalized {
			file := filepath.Join(root, filepath.FromSlash(name))
			if data, found := cache[file]; found {
				return protocompile.SearchResult{Source: strings.NewReader(string(data))}, nil
			}
			data, err := policy.ReadFile(file)
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			if err != nil {
				return protocompile.SearchResult{}, err
			}
			if count+1 > maxProtoFiles || size+len(data) > maxProtoBytes {
				return protocompile.SearchResult{}, localizedConfigError(locales.EngineGrpcImportRootsLimit, nil)
			}
			count++
			size += len(data)
			cache[file] = data
			return protocompile.SearchResult{Source: strings.NewReader(string(data))}, nil
		}
		return protocompile.SearchResult{}, os.ErrNotExist
	}), nil
}

func safeImportPath(value string) bool {
	return value != "" && !strings.ContainsAny(value, "\\:") && filepath.IsLocal(value) &&
		!strings.HasPrefix(value, "~") && !strings.Contains(value, "//")
}

func safeImportRoot(root string, allowAbsolute bool) bool {
	if strings.HasPrefix(root, "//") || strings.Contains(root, "/../") || strings.HasSuffix(root, "/..") {
		return false
	}
	if allowAbsolute {
		return filepath.IsAbs(filepath.FromSlash(root)) || root == "~" || strings.HasPrefix(root, "~/")
	}
	return safeImportPath(root)
}
