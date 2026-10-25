package engine

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/textproto"
	"net/url"
	"strings"
)

const (
	BodyNone      = "none"
	BodyJSON      = "json"
	BodyText      = "text"
	BodyXML       = "xml"
	BodyForm      = "form"
	BodyMultipart = "multipart"
	BodyBinary    = "binary"
)

const (
	contentTypeJSON   = "application/json"
	contentTypeBinary = "application/octet-stream"
)

var rawContentTypes = map[string]string{
	BodyJSON: contentTypeJSON,
	BodyText: "text/plain",
	BodyXML:  "application/xml",
}

type filePart struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Type        string `json:"type"`
	FileName    string `json:"fileName"`
	ContentType string `json:"contentType"`
	Data        string `json:"data"`
	Path        string `json:"path"`
	Enabled     *bool  `json:"enabled"`
}

func (p filePart) isFile() bool { return p.Type == "file" }

func (p filePart) isAttached() bool { return p.Path != "" }

func (p filePart) disabled() bool { return p.Enabled != nil && !*p.Enabled }

func (p filePart) bytes() ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(p.Data)
	if err != nil {
		return nil, fmt.Errorf("file %q is not valid base64: %w", p.FileName, err)
	}
	return data, nil
}

func (p filePart) contentType() string {
	if p.ContentType == "" {
		return contentTypeBinary
	}
	return p.ContentType
}

type builtBody struct {
	data        []byte
	contentType string
	parts       []PreparedPart
	file        string
}

func plainBody(data []byte, contentType string, err error) (builtBody, error) {
	return builtBody{data: data, contentType: contentType}, err
}

func buildBody(r Request, isGraphQL bool, substitute func(string) string, stream *bodyStream) (builtBody, error) {
	if isGraphQL {
		return plainBody(graphqlBody(r, substitute))
	}
	switch r.BodyType {
	case BodyNone:
		return builtBody{}, nil
	case BodyForm:
		return plainBody(formBody(r.Body, substitute))
	case BodyMultipart:
		return multipartBody(r.Body, substitute, stream)
	case BodyBinary:
		return binaryBody(r.Body, stream)
	default:
		return plainBody(rawBody(r, substitute))
	}
}

func rawBody(r Request, substitute func(string) string) ([]byte, string, error) {
	body := substitute(r.Body)
	if body == "" {
		return nil, "", nil
	}
	contentType := rawContentTypes[r.BodyType]
	if r.BodyType == "" && json.Valid([]byte(body)) {
		contentType = contentTypeJSON
	}
	return []byte(body), contentType, nil
}

func graphqlBody(r Request, substitute func(string) string) ([]byte, string, error) {
	query := r.GraphqlQuery
	if strings.TrimSpace(query) == "" {
		query = r.Body
	}
	payload := map[string]any{"query": substitute(query)}

	if variables := strings.TrimSpace(substitute(r.GraphqlVariables)); variables != "" {
		decoded, err := decodeJSON(variables)
		if err != nil {
			return nil, "", fmt.Errorf("GraphQL variables are not valid JSON: %w", err)
		}
		payload["variables"] = decoded
	}

	body, err := json.Marshal(payload)
	return body, contentTypeJSON, err
}

func formBody(raw string, substitute func(string) string) ([]byte, string, error) {
	pairs, err := parsePairs(raw)
	if err != nil {
		return nil, "", fmt.Errorf("form body is not valid: %w", err)
	}
	fields := make([]string, 0, len(pairs))
	for _, p := range substitutePairs(pairs, substitute) {
		fields = append(fields, url.QueryEscape(p.key)+"="+url.QueryEscape(p.value))
	}
	return []byte(strings.Join(fields, "&")), "application/x-www-form-urlencoded", nil
}

func inline(stream *bodyStream) []byte {
	if stream.streamed() {
		return nil
	}
	return stream.bytes()
}

func multipartBody(raw string, substitute func(string) string, stream *bodyStream) (builtBody, error) {
	var parts []filePart
	if strings.TrimSpace(raw) != "" {
		if err := json.Unmarshal([]byte(raw), &parts); err != nil {
			return builtBody{}, fmt.Errorf("multipart body is not valid: %w", err)
		}
	}

	writer := multipart.NewWriter(stream)
	var written []PreparedPart
	for _, part := range parts {
		if part.disabled() || strings.TrimSpace(part.Key) == "" {
			continue
		}
		described, err := writePart(writer, part, substitute, stream)
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

func writePart(writer *multipart.Writer, part filePart, substitute func(string) string, stream *bodyStream) (PreparedPart, error) {
	key := substitute(part.Key)
	if !part.isFile() {
		value := substitute(part.Value)
		return PreparedPart{Name: key, Value: value}, writer.WriteField(key, value)
	}

	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name=%q; filename=%q`, key, part.FileName))
	if part.isAttached() {
		described := PreparedPart{Name: key, File: part.FileName, ContentType: attachedType(part.ContentType, part.Path)}
		header.Set("Content-Type", described.ContentType)
		if _, err := writer.CreatePart(header); err != nil {
			return described, err
		}
		return described, stream.attach(part.FileName, part.Path)
	}

	described := PreparedPart{Name: key, File: part.FileName, ContentType: part.contentType()}
	data, err := part.bytes()
	if err != nil {
		return described, err
	}
	header.Set("Content-Type", described.ContentType)
	target, err := writer.CreatePart(header)
	if err != nil {
		return described, err
	}
	_, err = target.Write(data)
	return described, err
}

func binaryBody(raw string, stream *bodyStream) (builtBody, error) {
	if strings.TrimSpace(raw) == "" {
		return builtBody{}, nil
	}
	var file filePart
	if err := json.Unmarshal([]byte(raw), &file); err != nil {
		return builtBody{}, fmt.Errorf("file body is not valid: %w", err)
	}
	if file.isAttached() {
		built := builtBody{contentType: attachedType(file.ContentType, file.Path), file: file.FileName}
		return built, stream.attach(file.FileName, file.Path)
	}
	data, err := file.bytes()
	if err != nil {
		return builtBody{}, err
	}
	return builtBody{data: data, contentType: file.contentType(), file: file.FileName}, nil
}
