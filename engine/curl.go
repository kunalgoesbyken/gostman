package engine

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type row struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Enabled     bool   `json:"enabled"`
	Type        string `json:"type,omitempty"`
	FileName    string `json:"fileName,omitempty"`
	ContentType string `json:"contentType,omitempty"`
	Path        string `json:"path,omitempty"`
}

const (
	curlFilePrefix    = "@"
	curlContentPrefix = "<"
	curlStdin         = "-"
	formParamType     = "type"
	formParamFileName = "filename"
)

var curlValueFlags = withIgnoredFlags(map[string]string{
	"-X": "request", "--request": "request",
	"-H": "header", "--header": "header",
	"-d": "data", "--data": "data", "--data-raw": "data-raw", "--data-binary": "data", "--data-ascii": "data",
	"--data-urlencode": "data-urlencode",
	"--json":           "json",
	"-F":               "form", "--form": "form", "--form-string": "form-string",
	"-u": "user", "--user": "user",
	"-b": "cookie", "--cookie": "cookie",
	"-A": "user-agent", "--user-agent": "user-agent",
	"-e": "referer", "--referer": "referer",
	"-m": "max-time", "--max-time": "max-time",
	"--url": "url",
},
	"-C", "-D", "-E", "-K", "-P", "-Q", "-T", "-U", "-c", "-o", "-r", "-t", "-w", "-x", "-y", "-Y", "-z",
	"--abstract-unix-socket", "--alt-svc", "--aws-sigv4", "--cacert", "--capath", "--cert", "--cert-type",
	"--ciphers", "--config", "--connect-timeout", "--connect-to", "--continue-at", "--cookie-jar",
	"--create-file-mode", "--crlfile", "--curves", "--delegation", "--dns-interface", "--dns-ipv4-addr",
	"--dns-ipv6-addr", "--dns-servers", "--doh-url", "--dump-header", "--ech", "--egd-file", "--engine",
	"--etag-compare", "--etag-save", "--expect100-timeout", "--ftp-account", "--ftp-alternative-to-user",
	"--ftp-method", "--ftp-port", "--ftp-ssl-ccc-mode", "--happy-eyeballs-timeout-ms", "--haproxy-clientip",
	"--hostpubmd5", "--hostpubsha256", "--hsts", "--interface", "--ip-tos", "--ipfs-gateway",
	"--keepalive-cnt", "--keepalive-time", "--key", "--key-type", "--krb", "--libcurl", "--limit-rate",
	"--local-port", "--login-options", "--mail-auth", "--mail-from", "--mail-rcpt", "--max-filesize",
	"--max-redirs", "--netrc-file", "--noproxy", "--oauth2-bearer", "--output", "--output-dir",
	"--parallel-max", "--pass", "--pinnedpubkey", "--preproxy", "--proto", "--proto-default", "--proto-redir",
	"--proxy", "--proxy-cacert", "--proxy-capath", "--proxy-cert", "--proxy-cert-type", "--proxy-ciphers",
	"--proxy-crlfile", "--proxy-header", "--proxy-key", "--proxy-key-type", "--proxy-pass",
	"--proxy-pinnedpubkey", "--proxy-service-name", "--proxy-tls13-ciphers", "--proxy-tlsauthtype",
	"--proxy-tlspassword", "--proxy-tlsuser", "--proxy-user", "--proxy1.0", "--pubkey", "--quote",
	"--random-file", "--range", "--rate", "--request-target", "--resolve", "--retry", "--retry-delay",
	"--retry-max-time", "--sasl-authzid", "--service-name", "--socks4", "--socks4a", "--socks5",
	"--socks5-gssapi-service", "--socks5-hostname", "--speed-limit", "--speed-time", "--stderr",
	"--telnet-option", "--tftp-blksize", "--time-cond", "--tls-max", "--tls13-ciphers", "--tlsauthtype",
	"--tlspassword", "--tlsuser", "--trace", "--trace-ascii", "--trace-config", "--unix-socket",
	"--upload-file", "--url-query", "--variable", "--write-out",
)

var curlSwitches = map[string]string{
	"-G": "get", "--get": "get",
	"-I": "head", "--head": "head",
	"--http1.1": "http1", "--http2": "http2", "--http2-prior-knowledge": "http2",
}

type curlCommand struct {
	request   Request
	headers   []row
	data      []string
	formParts []row
	asQuery   bool
}

type curlOption struct {
	name     string
	value    string
	attached bool
}

func withIgnoredFlags(flags map[string]string, ignored ...string) map[string]string {
	for _, name := range ignored {
		flags[name] = "ignored"
	}
	return flags
}

func ParseCurl(command string) (Request, error) {
	tokens, err := shellSplit(command)
	if err != nil {
		return Request{}, err
	}
	if len(tokens) == 0 || !strings.EqualFold(tokens[0], "curl") {
		return Request{}, fmt.Errorf("not a curl command")
	}

	parsed := &curlCommand{}
	var positional []string
	for i := 1; i < len(tokens); i++ {
		if !isCurlOption(tokens[i]) {
			positional = append(positional, tokens[i])
			continue
		}
		for _, option := range splitOptions(tokens[i]) {
			kind, takesValue := curlValueFlags[option.name]
			if !takesValue {
				parsed.applySwitch(curlSwitches[option.name])
				continue
			}
			if !option.attached {
				if i+1 >= len(tokens) {
					return Request{}, fmt.Errorf("%s needs a value", option.name)
				}
				i++
				option.value = tokens[i]
			}
			parsed.applyValue(kind, option.value)
		}
	}
	if parsed.request.URL == "" {
		parsed.request.URL = likeliestURL(positional)
	}
	return parsed.build()
}

func isCurlOption(token string) bool {
	return len(token) > 1 && token[0] == '-'
}

func splitOptions(token string) []curlOption {
	if strings.HasPrefix(token, "--") {
		name, value, attached := strings.Cut(token, "=")
		return []curlOption{{name: name, value: value, attached: attached}}
	}
	var options []curlOption
	letters := []rune(token[1:])
	for i, letter := range letters {
		name := "-" + string(letter)
		if _, takesValue := curlValueFlags[name]; takesValue {
			value := string(letters[i+1:])
			return append(options, curlOption{name: name, value: value, attached: value != ""})
		}
		options = append(options, curlOption{name: name})
	}
	return options
}

func likeliestURL(candidates []string) string {
	best, bestScore := "", -1
	for _, candidate := range candidates {
		if score := urlScore(candidate); score > bestScore {
			best, bestScore = candidate, score
		}
	}
	return best
}

func urlScore(value string) int {
	switch {
	case strings.Contains(value, "://"):
		return 2
	case strings.ContainsAny(value, "./:"):
		return 1
	}
	return 0
}

func (c *curlCommand) applyValue(kind, value string) {
	switch kind {
	case "request":
		c.request.Method = strings.ToUpper(value)
	case "header":
		if key, headerValue, found := strings.Cut(value, ":"); found {
			c.addHeader(strings.TrimSpace(key), strings.TrimSpace(headerValue))
		}
	case "data":
		c.data = append(c.data, fileData(value))
	case "data-raw":
		c.data = append(c.data, value)
	case "data-urlencode":
		c.data = append(c.data, urlEncodeData(value))
	case "json":
		c.data = append(c.data, fileData(value))
		c.addHeader(headerContentType, contentTypeJSON)
	case "form":
		c.formParts = append(c.formParts, formRow(value))
	case "form-string":
		c.formParts = append(c.formParts, textRow(value))
	case "user":
		username, password, _ := strings.Cut(value, ":")
		c.request.Auth = Auth{Type: authBasic, Username: username, Password: password}
	case "cookie":
		c.addHeader("Cookie", value)
	case "user-agent":
		c.addHeader("User-Agent", value)
	case "referer":
		c.addHeader("Referer", value)
	case "max-time":
		if seconds, err := strconv.ParseFloat(value, 64); err == nil {
			c.request.Options.TimeoutMs = int(seconds * 1000)
		}
	case "url":
		c.request.URL = value
	}
}

func (c *curlCommand) applySwitch(kind string) {
	switch kind {
	case "get":
		c.asQuery = true
	case "head":
		c.request.Method = http.MethodHead
	case "http1":
		c.request.Options.HTTPVersion = HTTPVersion1
	case "http2":
		c.request.Options.HTTPVersion = HTTPVersion2
	}
}

func (c *curlCommand) addHeader(key, value string) {
	c.headers = append(c.headers, row{Key: key, Value: value, Enabled: true})
}

func (c *curlCommand) header(name string) string {
	for _, header := range c.headers {
		if strings.EqualFold(header.Key, name) {
			return header.Value
		}
	}
	return ""
}

func (c *curlCommand) build() (Request, error) {
	request := c.request
	if request.URL == "" {
		return Request{}, fmt.Errorf("the curl command has no URL")
	}

	data := strings.Join(c.data, "&")
	switch {
	case len(c.formParts) > 0:
		request.BodyType = BodyMultipart
		request.Body = encodeRows(c.formParts)
	case c.asQuery && data != "":
		separator := "?"
		if strings.Contains(request.URL, "?") {
			separator = "&"
		}
		request.URL += separator + data
	case data != "":
		request.BodyType, request.Body = classifyData(data, c.header(headerContentType))
	}

	if request.Method == "" {
		request.Method = http.MethodGet
		if request.Body != "" {
			request.Method = http.MethodPost
		}
	}
	request.Headers = encodeRows(c.headers)
	return request, nil
}

func classifyData(data, contentType string) (string, string) {
	contentType = strings.ToLower(contentType)
	switch {
	case strings.Contains(contentType, "json"), contentType == "" && json.Valid([]byte(data)):
		return BodyJSON, data
	case strings.Contains(contentType, "xml"):
		return BodyXML, data
	case contentType == "" || strings.Contains(contentType, "x-www-form-urlencoded"):
		if rows, ok := formRows(data); ok {
			return BodyForm, encodeRows(rows)
		}
	}
	return BodyText, data
}

func formRows(data string) ([]row, bool) {
	var rows []row
	for _, field := range strings.Split(data, "&") {
		key, value, found := strings.Cut(field, "=")
		if !found {
			return nil, false
		}
		decodedKey, keyErr := url.QueryUnescape(key)
		decodedValue, valueErr := url.QueryUnescape(value)
		if keyErr != nil || valueErr != nil {
			return nil, false
		}
		rows = append(rows, row{Key: decodedKey, Value: decodedValue, Enabled: true})
	}
	return rows, true
}

func textRow(value string) row {
	key, content, _ := strings.Cut(value, "=")
	return row{Key: key, Value: strings.Trim(content, `"`), Enabled: true, Type: "text"}
}

func formRow(value string) row {
	key, content, _ := strings.Cut(value, "=")
	switch {
	case readsCurlFile(content, curlFilePrefix):
		return fileRow(key, content[len(curlFilePrefix):])
	case readsCurlFile(content, curlContentPrefix):
		path, _ := formParams(content[len(curlContentPrefix):])
		return row{Key: key, Value: curlFileReference(path), Enabled: true, Type: "text"}
	}
	return textRow(value)
}

func fileRow(key, spec string) row {
	path, params := formParams(spec)
	name := params[formParamFileName]
	if name == "" {
		name = path[strings.LastIndexAny(path, `/\`)+1:]
	}
	return row{Key: key, Enabled: true, Type: "file", FileName: name, ContentType: params[formParamType], Path: path}
}

func formParams(spec string) (string, map[string]string) {
	fields := strings.Split(spec, ";")
	params := map[string]string{}
	for _, field := range fields[1:] {
		if name, value, found := strings.Cut(field, "="); found {
			params[strings.ToLower(strings.TrimSpace(name))] = strings.Trim(strings.TrimSpace(value), `"`)
		}
	}
	return strings.Trim(fields[0], `"`), params
}

func readsCurlFile(value, prefix string) bool {
	return strings.HasPrefix(value, prefix) && len(value) > len(prefix) && value[len(prefix):] != curlStdin
}

func fileData(value string) string {
	if !readsCurlFile(value, curlFilePrefix) {
		return value
	}
	return curlFileReference(value[len(curlFilePrefix):])
}

func curlFileReference(path string) string {
	return "{{$file(" + path + ")}}"
}

func urlEncodeData(value string) string {
	name, content, found := strings.Cut(value, "=")
	if !found {
		return url.QueryEscape(value)
	}
	if name == "" {
		return url.QueryEscape(content)
	}
	return name + "=" + url.QueryEscape(content)
}

func encodeRows(rows []row) string {
	if len(rows) == 0 {
		return "[]"
	}
	encoded, _ := json.Marshal(rows)
	return string(encoded)
}

func shellSplit(command string) ([]string, error) {
	var (
		tokens  []string
		current strings.Builder
		inToken bool
		quote   rune
		ansi    bool
	)
	runes := []rune(strings.ReplaceAll(command, "\r\n", "\n"))
	flush := func() {
		if inToken {
			tokens = append(tokens, current.String())
			current.Reset()
			inToken = false
		}
	}

	for i := 0; i < len(runes); i++ {
		char := runes[i]
		switch {
		case quote == '\'':
			if char == '\'' {
				quote, ansi = 0, false
			} else if ansi && char == '\\' && i+1 < len(runes) {
				i++
				current.WriteRune(unescapeANSI(runes[i]))
			} else {
				current.WriteRune(char)
			}
		case quote == '"':
			if char == '"' {
				quote = 0
			} else if char == '\\' && i+1 < len(runes) && strings.ContainsRune("\"\\$`\n", runes[i+1]) {
				i++
				if runes[i] != '\n' {
					current.WriteRune(runes[i])
				}
			} else {
				current.WriteRune(char)
			}
		case char == '\'' || char == '"':
			quote, inToken = char, true
		case char == '$' && i+1 < len(runes) && runes[i+1] == '\'':
			i++
			quote, ansi, inToken = '\'', true, true
		case char == '\\' && i+1 < len(runes):
			i++
			if runes[i] != '\n' {
				current.WriteRune(runes[i])
				inToken = true
			}
		case char == ' ' || char == '\t' || char == '\n':
			flush()
		default:
			current.WriteRune(char)
			inToken = true
		}
	}
	if quote != 0 {
		return nil, fmt.Errorf("the curl command has an unclosed quote")
	}
	flush()
	return tokens, nil
}

func unescapeANSI(char rune) rune {
	switch char {
	case 'n':
		return '\n'
	case 't':
		return '\t'
	case 'r':
		return '\r'
	default:
		return char
	}
}
