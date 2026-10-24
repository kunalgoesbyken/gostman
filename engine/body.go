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

func buildBody(r Request, isGraphQL bool, substitute func(string) string, stream *bodyStream) ([]byte, string, error) {
	if isGraphQL {
		return graphqlBody(r, substitute)
	}
	switch r.BodyType {
	case BodyNone:
		return nil, "", nil
	case BodyForm:
		return formBody(r.Body, substitute)
	case BodyMultipart:
		return multipartBody(r.Body, substitute, stream)
	case BodyBinary:
		return binaryBody(r.Body, stream)
	default:
		return rawBody(r, substitute)
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

func multipartBody(raw string, substitute func(string) string, stream *bodyStream) ([]byte, string, error) {
	var parts []filePart
	if strings.TrimSpace(raw) != "" {
		if err := json.Unmarshal([]byte(raw), &parts); err != nil {
			return nil, "", fmt.Errorf("multipart body is not valid: %w", err)
		}
	}

	writer := multipart.NewWriter(stream)
	for _, part := range parts {
		if part.disabled() || strings.TrimSpace(part.Key) == "" {
			continue
		}
		if err := writePart(writer, part, substitute, stream); err != nil {
			return nil, "", err
		}
	}
	if err := writer.Close(); err != nil {
		return nil, "", err
	}
	return inline(stream), writer.FormDataContentType(), nil
}

func writePart(writer *multipart.Writer, part filePart, substitute func(string) string, stream *bodyStream) error {
	key := substitute(part.Key)
	if !part.isFile() {
		return writer.WriteField(key, substitute(part.Value))
	}

	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name=%q; filename=%q`, key, part.FileName))
	if part.isAttached() {
		header.Set("Content-Type", attachedType(part.ContentType, part.Path))
		if _, err := writer.CreatePart(header); err != nil {
			return err
		}
		return stream.attach(part.FileName, part.Path)
	}

	data, err := part.bytes()
	if err != nil {
		return err
	}
	header.Set("Content-Type", part.contentType())
	target, err := writer.CreatePart(header)
	if err != nil {
		return err
	}
	_, err = target.Write(data)
	return err
}

func binaryBody(raw string, stream *bodyStream) ([]byte, string, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, "", nil
	}
	var file filePart
	if err := json.Unmarshal([]byte(raw), &file); err != nil {
		return nil, "", fmt.Errorf("file body is not valid: %w", err)
	}
	if file.isAttached() {
		return nil, attachedType(file.ContentType, file.Path), stream.attach(file.FileName, file.Path)
	}
	data, err := file.bytes()
	if err != nil {
		return nil, "", err
	}
	return data, file.contentType(), nil
}
