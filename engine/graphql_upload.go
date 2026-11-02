package engine

import (
	"encoding/json"
	"fmt"
	"mime/multipart"
	"strconv"
	"strings"
)

const graphqlVariablesPrefix = "variables."

func graphqlFileParts(r Request) ([]filePart, error) {
	if r.BodyType != BodyMultipart || strings.TrimSpace(r.Body) == "" {
		return nil, nil
	}
	var rows []filePart
	if err := json.Unmarshal([]byte(r.Body), &rows); err != nil {
		return nil, fmt.Errorf("GraphQL files are not valid: %w", err)
	}
	var files []filePart
	for _, row := range rows {
		if row.isFile() && !row.disabled() && strings.TrimSpace(row.Key) != "" {
			files = append(files, row)
		}
	}
	return files, nil
}

func graphqlOperation(r Request, substitute func(string) string) (map[string]any, error) {
	query := r.GraphqlQuery
	if strings.TrimSpace(query) == "" {
		query = r.Body
	}
	operation := map[string]any{"query": substitute(query)}
	variables := map[string]any{}
	if text := strings.TrimSpace(substitute(r.GraphqlVariables)); text != "" {
		decoded, err := decodeJSON(text)
		if err != nil {
			return nil, fmt.Errorf("GraphQL variables are not valid JSON: %w", err)
		}
		object, isObject := decoded.(map[string]any)
		if !isObject {
			return nil, fmt.Errorf("GraphQL variables must be a JSON object to carry files")
		}
		variables = object
	}
	operation["variables"] = variables
	return operation, nil
}

func variablePath(key string) []string {
	path := strings.TrimPrefix(strings.TrimSpace(key), graphqlVariablesPrefix)
	return strings.Split(path, ".")
}

func nullAt(container any, path []string) (any, error) {
	if len(path) == 0 {
		return nil, nil
	}
	head, rest := path[0], path[1:]
	switch current := container.(type) {
	case map[string]any:
		child, err := nullAt(current[head], rest)
		current[head] = child
		return current, err
	case []any:
		index, err := strconv.Atoi(head)
		if err != nil || index < 0 || index > len(current) {
			return current, fmt.Errorf("%q is not a position in the list", head)
		}
		if index == len(current) {
			current = append(current, nil)
		}
		child, err := nullAt(current[index], rest)
		current[index] = child
		return current, err
	case nil:
		return nullAt(map[string]any{}, path)
	}
	return container, fmt.Errorf("%q cannot hold a file because the variable is not an object or a list", head)
}

func graphqlUploadBody(r Request, files []filePart, substitute func(string) string, stream *bodyStream) (builtBody, error) {
	operation, err := graphqlOperation(r, substitute)
	if err != nil {
		return builtBody{}, err
	}
	mapping := map[string][]string{}
	for index, file := range files {
		path := variablePath(substitute(file.Key))
		if _, err := nullAt(operation["variables"], path); err != nil {
			return builtBody{}, fmt.Errorf("GraphQL file %q: %w", file.Key, err)
		}
		mapping[strconv.Itoa(index)] = []string{graphqlVariablesPrefix + strings.Join(path, ".")}
	}
	operations, err := json.Marshal(operation)
	if err != nil {
		return builtBody{}, err
	}
	encodedMap, err := json.Marshal(mapping)
	if err != nil {
		return builtBody{}, err
	}

	writer := multipart.NewWriter(stream)
	written := []PreparedPart{{Name: "operations", Value: string(operations)}, {Name: "map", Value: string(encodedMap)}}
	if err := writer.WriteField("operations", string(operations)); err != nil {
		return builtBody{}, err
	}
	if err := writer.WriteField("map", string(encodedMap)); err != nil {
		return builtBody{}, err
	}
	for index, file := range files {
		file.Key = strconv.Itoa(index)
		described, err := writePart(writer, file, substitute, stream)
		if err != nil {
			return builtBody{}, err
		}
		written = append(written, described)
	}
	if err := writer.Close(); err != nil {
		return builtBody{}, err
	}
	return builtBody{data: inline(stream), contentType: writer.FormDataContentType(), parts: written}, nil
}
