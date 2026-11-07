package engine

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
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

const (
	curlIgnored    = "ignored"
	curlEndOfFlags = "--"
	curlLongPrefix = "--"
	curlNegation   = "--no-"
	curlShortFlag  = "-"
)

var curlValueFlags = map[string]string{
	"-X": "request", "--request": "request",
	"-H": "header", "--header": "header",
	"-d": "data", "--data": "data", "--data-raw": "data-raw", "--data-binary": "data", "--data-ascii": "data",
	"--data-urlencode": "data-urlencode",
	"--url-query":      "url-query",
	"--json":           "json",
	"-F":               "form", "--form": "form", "--form-string": "form-string",
	"-u": "user", "--user": "user",
	"--oauth2-bearer": "bearer",
	"-b":              "cookie", "--cookie": "cookie",
	"-A": "user-agent", "--user-agent": "user-agent",
	"-e": "referer", "--referer": "referer",
	"-m": "max-time", "--max-time": "max-time",
	"--url": "url",
	"-T":    "upload", "--upload-file": "upload",
}

var curlSwitches = map[string]string{
	"-G": "get", "--get": "get",
	"-I": "head", "--head": "head",
	"-g": "globoff", "--globoff": "globoff",
	"--http1.1": "http1", "--http2": "http2", "--http2-prior-knowledge": "http2",
}

var curlOtherValueFlags = wordSet(`
	-E -K -C -c -D -P -Q -r -t -z -w -Y -y -x -U -o
	--abstract-unix-socket --alt-svc --aws-sigv4 --cacert --capath --cert --cert-type --ciphers
	--config --connect-timeout --connect-to --continue-at --cookie-jar --create-file-mode --crlfile
	--curves --delegation --dns-interface --dns-ipv4-addr --dns-ipv6-addr --dns-servers --doh-url
	--dump-header --ech --egd-file --engine --etag-compare --etag-save --expect100-timeout
	--ftp-account --ftp-alternative-to-user --ftp-method --ftp-port --ftp-ssl-ccc-mode
	--happy-eyeballs-timeout-ms --haproxy-clientip --hostpubmd5 --hostpubsha256 --hsts --interface
	--ip-tos --ipfs-gateway --keepalive-cnt --keepalive-time --key --key-type --knownhosts --krb --krb4
	--libcurl --limit-rate --local-port --login-options --mail-auth --mail-from --mail-rcpt
	--max-filesize --max-redirs --netrc-file --noproxy --output --output-dir --parallel-max
	--parallel-max-host --pass --pinnedpubkey --preproxy --proto --proto-default --proto-redir --proxy
	--proxy-cacert --proxy-capath --proxy-cert --proxy-cert-type --proxy-ciphers --proxy-crlfile
	--proxy-header --proxy-key --proxy-key-type --proxy-pass --proxy-pinnedpubkey --proxy-service-name
	--proxy-tls13-ciphers --proxy-tlsauthtype --proxy-tlspassword --proxy-tlsuser --proxy-user
	--proxy1.0 --pubkey --quote --random-file --range --rate --request-target --resolve --retry
	--retry-delay --retry-max-time --sasl-authzid --service-name --sigalgs --socks4 --socks4a --socks5
	--socks5-gssapi-service --socks5-hostname --speed-limit --speed-time --ssl-sessions --stderr
	--telnet-option --tftp-blksize --time-cond --tls-max --tls13-ciphers --tlsauthtype --tlspassword
	--tlsuser --trace --trace-ascii --trace-config --unix-socket --upload-flags
	--variable --vlan-priority --write-out
`)

var curlOtherSwitches = wordSet(`
	-a -q -f -0 -4 -6 -j -l -L -M -n -: -N -Z -# -p -J -O -R -S -i -s -2 -3 -1 -B -v -V -k -h
	--anyauth --append --basic --ca-native --cert-status --compressed --compressed-ssh --create-dirs
	--crlf --digest --disable --disable-eprt --disable-epsv --disallow-username-in-url
	--doh-cert-status --doh-insecure --dump-ca-embed --fail --fail-early --fail-with-body
	--false-start --follow --form-escape --ftp-create-dirs --ftp-pasv --ftp-pret --ftp-skip-pasv-ip
	--ftp-ssl --ftp-ssl-ccc --ftp-ssl-control --haproxy-protocol --help --http0.9 --http1.0
	--http3 --http3-only --ignore-content-length --include --insecure --ipv4 --ipv6
	--junk-session-cookies --list-only --location --location-trusted --mail-rcpt-allowfails --manual
	--metalink --mptcp --negotiate --netrc --netrc-optional --next --alpn --npn --buffer --clobber
	--keepalive --progress-meter --sessionid --ntlm --ntlm-wb --out-null --parallel
	--parallel-immediate --path-as-is --post301 --post302 --post303 --progress-bar --proxy-anyauth
	--proxy-basic --proxy-ca-native --proxy-digest --proxy-http2 --proxy-insecure --proxy-negotiate
	--proxy-ntlm --proxy-ssl-allow-beast --proxy-ssl-auto-client-cert --proxy-tlsv1 --proxytunnel
	--raw --remote-header-name --remote-name --remote-name-all --remote-time --remove-on-error
	--retry-all-errors --retry-connrefused --sasl-ir --show-error --show-headers --silent
	--skip-existing --socks5-basic --socks5-gssapi --socks5-gssapi-nec --ssl --ssl-allow-beast
	--ssl-auto-client-cert --ssl-no-revoke --ssl-reqd --ssl-revoke-best-effort --sslv2 --sslv3
	--styled-output --suppress-connect-headers --tcp-fastopen --tcp-nodelay --tftp-no-options
	--tls-earlydata --tlsv1 --tlsv1.0 --tlsv1.1 --tlsv1.2 --tlsv1.3 --tr-encoding --trace-ids
	--trace-time --use-ascii --verbose --version --xattr
`)

type curlOption struct {
	kind       string
	takesValue bool
}

type curlCommand struct {
	request   Request
	headers   []row
	data      []string
	query     []string
	formParts []row
	asQuery   bool
	uploads   bool
	globoff   bool
}

var curlGlobEscapes = strings.NewReplacer(`\[`, "[", `\]`, "]", `\{`, "{", `\}`, "}")

type curlWord struct {
	text         string
	afterUnknown string
}

func wordSet(text string) map[string]bool {
	set := map[string]bool{}
	for _, word := range strings.Fields(text) {
		set[word] = true
	}
	return set
}

func ParseCurl(command string) (Request, error) {
	tokens, err := splitCommand(command)
	if err != nil {
		return Request{}, err
	}
	if len(tokens) == 0 || !isCurlProgram(tokens[0]) {
		return Request{}, locales.Errorf(locales.EngineCurlNotCurl, nil)
	}

	parsed := &curlCommand{}
	var words []curlWord
	unknown := ""
	optionsEnded := false
	for i := 1; i < len(tokens); i++ {
		token := tokens[i]
		switch {
		case optionsEnded || !isCurlOption(token):
			words = append(words, curlWord{text: token, afterUnknown: unknown})
			unknown = ""
		case token == curlEndOfFlags:
			optionsEnded = true
		default:
			i, unknown, err = parsed.readOption(tokens, i)
			if err != nil {
				return Request{}, err
			}
		}
	}
	if parsed.request.URL == "" {
		if parsed.request.URL, err = chooseCurlURL(words); err != nil {
			return Request{}, err
		}
	}
	return parsed.build()
}

func isCurlOption(token string) bool {
	return len(token) > 1 && strings.HasPrefix(token, curlShortFlag)
}

func lookupCurlOption(name string) (curlOption, bool) {
	if kind, ok := curlValueFlags[name]; ok {
		return curlOption{kind: kind, takesValue: true}, true
	}
	if kind, ok := curlSwitches[name]; ok {
		return curlOption{kind: kind}, true
	}
	if curlOtherValueFlags[name] {
		return curlOption{kind: curlIgnored, takesValue: true}, true
	}
	if curlOtherSwitches[name] {
		return curlOption{kind: curlIgnored}, true
	}
	if base, negated := strings.CutPrefix(name, curlNegation); negated && curlOtherSwitches[curlLongPrefix+base] {
		return curlOption{kind: curlIgnored}, true
	}
	return curlOption{}, false
}

func (c *curlCommand) readOption(tokens []string, i int) (int, string, error) {
	token := tokens[i]
	if strings.HasPrefix(token, curlLongPrefix) {
		return c.readLongOption(tokens, i)
	}
	unknown := ""
	bundle := token[len(curlShortFlag):]
	for offset, char := range bundle {
		name := curlShortFlag + string(char)
		option, known := lookupCurlOption(name)
		switch {
		case !known:
			unknown = token
		case !option.takesValue:
			c.applySwitch(option.kind)
		default:
			if rest := bundle[offset+len(string(char)):]; rest != "" {
				c.applyValue(option.kind, rest)
				return i, "", nil
			}
			return c.takeNext(tokens, i, name, option)
		}
	}
	return i, unknown, nil
}

func (c *curlCommand) readLongOption(tokens []string, i int) (int, string, error) {
	name, value, attached := strings.Cut(tokens[i], "=")
	option, known := lookupCurlOption(name)
	switch {
	case !known && attached:
		return i, "", nil
	case !known:
		return i, name, nil
	case !option.takesValue:
		c.applySwitch(option.kind)
		return i, "", nil
	case attached:
		c.applyValue(option.kind, value)
		return i, "", nil
	}
	return c.takeNext(tokens, i, name, option)
}

func (c *curlCommand) takeNext(tokens []string, i int, name string, option curlOption) (int, string, error) {
	if i+1 >= len(tokens) {
		return i, "", locales.Errorf(locales.EngineCurlNeedsValue, locales.Params{"option": name})
	}
	c.applyValue(option.kind, tokens[i+1])
	return i + 1, "", nil
}

func chooseCurlURL(words []curlWord) (string, error) {
	var plain, afterUnknown, bare []string
	for _, word := range words {
		switch {
		case looksLikeURL(word.text) && word.afterUnknown == "":
			plain = append(plain, word.text)
		case looksLikeURL(word.text):
			afterUnknown = append(afterUnknown, word.text)
		case word.afterUnknown == "":
			bare = append(bare, word.text)
		}
	}
	for _, group := range [][]string{plain, afterUnknown, bare} {
		if len(group) > 0 {
			return group[0], nil
		}
	}
	if len(words) > 0 {
		return "", locales.Errorf(locales.EngineCurlNoUrlAfterOption, locales.Params{"option": words[0].afterUnknown, "value": words[0].text})
	}
	return "", locales.Errorf(locales.EngineCurlNoUrl, nil)
}

func looksLikeURL(text string) bool {
	return strings.Contains(text, "://") || strings.HasPrefix(text, "{{") || strings.ContainsAny(text, "./:") || strings.EqualFold(text, "localhost")
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
	case "upload":
		c.uploads = true
	case "url-query":
		c.query = append(c.query, urlEncodeData(value))
	case "bearer":
		c.request.Auth = Auth{Type: authBearer, Token: value}
	case "url":
		if c.request.URL == "" {
			c.request.URL = value
		}
	}
}

func (c *curlCommand) applySwitch(kind string) {
	switch kind {
	case "get":
		c.asQuery = true
	case "head":
		c.request.Method = http.MethodHead
	case "globoff":
		c.globoff = true
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
		return Request{}, locales.Errorf(locales.EngineCurlNoUrl, nil)
	}

	if !c.globoff {
		request.URL = curlGlobEscapes.Replace(request.URL)
	}
	request.URL = withQuery(request.URL, strings.Join(c.query, "&"))
	data := strings.Join(c.data, "&")
	switch {
	case len(c.formParts) > 0:
		request.BodyType = BodyMultipart
		request.Body = encodeRows(c.formParts)
	case c.asQuery && data != "":
		request.URL = withQuery(request.URL, data)
	case data != "":
		request.BodyType, request.Body = classifyData(data, c.header(headerContentType))
	}

	if request.Method == "" {
		request.Method = c.impliedMethod()
	}
	request.Headers = encodeRows(c.headers)
	return request, nil
}

func (c *curlCommand) impliedMethod() string {
	switch {
	case len(c.formParts) > 0, len(c.data) > 0 && !c.asQuery:
		return http.MethodPost
	case c.uploads && !c.asQuery:
		return http.MethodPut
	}
	return http.MethodGet
}

func withQuery(address, query string) string {
	if query == "" {
		return address
	}
	separator := "?"
	if strings.Contains(address, "?") {
		separator = "&"
	}
	return address + separator + query
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

func isCurlProgram(token string) bool {
	name := strings.ToLower(token[strings.LastIndexAny(token, `/\`)+1:])
	return name == "curl" || name == "curl.exe"
}

func splitCommand(command string) ([]string, error) {
	command = strings.ReplaceAll(command, "\r\n", "\n")
	if isCmdCommand(command) {
		return crtSplit(cmdUnescape(command)), nil
	}
	return shellSplit(command)
}

func isCmdCommand(command string) bool {
	if strings.Contains(command, `^"`) {
		return true
	}
	for _, line := range strings.Split(command, "\n") {
		if strings.HasSuffix(strings.TrimRight(line, " \t"), "^") {
			return true
		}
	}
	return false
}

func cmdUnescape(command string) string {
	var out strings.Builder
	quoted := false
	runes := []rune(command)
	for i := 0; i < len(runes); i++ {
		char := runes[i]
		switch {
		case char == '"':
			quoted = !quoted
			out.WriteRune(char)
		case char == '^' && !quoted:
			i++
			if i < len(runes) && runes[i] != '\n' {
				out.WriteRune(runes[i])
			}
		default:
			out.WriteRune(char)
		}
	}
	return out.String()
}

func crtSplit(command string) []string {
	var (
		tokens  []string
		current strings.Builder
		inToken bool
		quoted  bool
	)
	runes := []rune(command)
	for i := 0; i < len(runes); i++ {
		char := runes[i]
		switch {
		case char == '\\':
			count := 1
			for i+count < len(runes) && runes[i+count] == '\\' {
				count++
			}
			i += count - 1
			inToken = true
			if i+1 < len(runes) && runes[i+1] == '"' {
				current.WriteString(strings.Repeat(`\`, count/2))
				if count%2 == 1 {
					i++
					current.WriteRune('"')
				}
			} else {
				current.WriteString(strings.Repeat(`\`, (count+1)/2))
			}
		case char == '"':
			inToken = true
			if quoted && i+1 < len(runes) && runes[i+1] == '"' {
				i++
				current.WriteRune('"')
			} else {
				quoted = !quoted
			}
		case !quoted && (char == ' ' || char == '\t' || char == '\n'):
			if inToken {
				tokens = append(tokens, current.String())
				current.Reset()
				inToken = false
			}
		default:
			current.WriteRune(char)
			inToken = true
		}
	}
	if inToken {
		tokens = append(tokens, current.String())
	}
	return tokens
}

func shellSplit(command string) ([]string, error) {
	var (
		tokens  []string
		current strings.Builder
		inToken bool
		quote   rune
		ansi    bool
	)
	runes := []rune(command)
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
				var text string
				text, i = ansiEscape(runes, i+1)
				current.WriteString(text)
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
		case char == '`' && i+1 < len(runes) && runes[i+1] == '\n':
			i++
		case char == ' ' || char == '\t' || char == '\n':
			flush()
		default:
			current.WriteRune(char)
			inToken = true
		}
	}
	if quote != 0 {
		return nil, locales.Errorf(locales.EngineCurlUnclosedQuote, nil)
	}
	flush()
	return tokens, nil
}

var ansiCharacters = map[rune]string{
	'n': "\n", 't': "\t", 'r': "\r", 'a': "\a", 'b': "\b", 'f': "\f", 'v': "\v", 'e': "\x1b", 'E': "\x1b",
}

var ansiNumbers = map[rune]struct{ base, digits int }{
	'x': {16, 2}, 'u': {16, 4}, 'U': {16, 8},
}

func ansiEscape(runes []rune, at int) (string, int) {
	char := runes[at]
	if text, ok := ansiCharacters[char]; ok {
		return text, at
	}
	if number, ok := ansiNumbers[char]; ok {
		if text, end, found := ansiNumber(runes, at+1, number.base, number.digits); found {
			return text, end
		}
		return `\` + string(char), at
	}
	if text, end, found := ansiNumber(runes, at, 8, 3); found {
		return text, end
	}
	return string(char), at
}

func ansiNumber(runes []rune, start, base, digits int) (string, int, bool) {
	end := start
	for end < len(runes) && end-start < digits && isDigitIn(runes[end], base) {
		end++
	}
	if end == start {
		return "", start, false
	}
	value, err := strconv.ParseUint(string(runes[start:end]), base, 32)
	if err != nil {
		return "", start, false
	}
	return string(rune(value)), end - 1, true
}

func isDigitIn(char rune, base int) bool {
	_, err := strconv.ParseUint(string(char), base, 8)
	return err == nil
}
