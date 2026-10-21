package engine

import (
	"crypto/md5"
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"hash"
	"io"
	"net/http"
	"strings"

	"golang.org/x/text/unicode/norm"
)

const (
	authDigest = "digest"

	digestScheme     = "digest"
	digestSessionTag = "-SESS"
	digestNonceCount = "00000001"
	digestDefaultAlg = "MD5"
	digestClientSize = 8
	challengeDrain   = 1 << 20

	headerWWWAuthenticate = "Www-Authenticate"
)

var (
	digestHashes = map[string]func() hash.Hash{
		"MD5":         md5.New,
		"SHA-256":     sha256.New,
		"SHA-512-256": sha512.New512_256,
	}
	digestQopPreference = []string{"auth", "auth-int"}
)

func authRoute(r Request, base http.RoundTripper) http.RoundTripper {
	if r.Auth.Type != authDigest && r.Auth.Type != authNTLM {
		return base
	}
	expansion, err := newSubstitution(r.Variables)
	if err != nil {
		return base
	}
	username, password := expansion.apply(r.Auth.Username), expansion.apply(r.Auth.Password)
	if r.Auth.Type == authNTLM {
		return ntlmRoute(base, username, password, expansion.apply(r.Auth.Domain))
	}
	return digestRoundTripper{base: base, username: username, password: password}
}

type digestRoundTripper struct {
	base     http.RoundTripper
	username string
	password string
}

func (t digestRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	response, err := t.base.RoundTrip(req)
	if err != nil || response.StatusCode != http.StatusUnauthorized {
		return response, err
	}
	challenge, ok := pickDigestChallenge(response.Header.Values(headerWWWAuthenticate))
	if !ok {
		return response, nil
	}
	retry, body, err := replay(req)
	if err != nil {
		return response, nil
	}
	header := challenge.answer(t.username, t.password, retry.Method, retry.URL.RequestURI(), body, randomHex(digestClientSize))
	io.Copy(io.Discard, io.LimitReader(response.Body, challengeDrain))
	response.Body.Close()
	retry.Header.Set(headerAuthorization, header)
	return t.base.RoundTrip(retry)
}

func replay(req *http.Request) (*http.Request, []byte, error) {
	retry := req.Clone(req.Context())
	if req.Body == nil || req.Body == http.NoBody || req.GetBody == nil {
		return retry, nil, nil
	}
	body, err := readBody(req)
	if err != nil {
		return nil, nil, err
	}
	if retry.Body, err = req.GetBody(); err != nil {
		return nil, nil, err
	}
	return retry, body, nil
}

func readBody(req *http.Request) ([]byte, error) {
	reader, err := req.GetBody()
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

type authChallenge struct {
	scheme string
	params map[string]string
}

type challengeScanner struct {
	text string
	at   int
}

func (s *challengeScanner) skip(separators string) {
	for s.at < len(s.text) && strings.IndexByte(separators, s.text[s.at]) >= 0 {
		s.at++
	}
}

func (s *challengeScanner) done() bool { return s.at >= len(s.text) }

func (s *challengeScanner) peek() byte { return s.text[s.at] }

func (s *challengeScanner) token() string {
	start := s.at
	for s.at < len(s.text) && strings.IndexByte(" \t,=", s.text[s.at]) < 0 {
		s.at++
	}
	return s.text[start:s.at]
}

func (s *challengeScanner) value() string {
	if s.done() || s.peek() != '"' {
		start := s.at
		for s.at < len(s.text) && s.text[s.at] != ',' {
			s.at++
		}
		return strings.TrimSpace(s.text[start:s.at])
	}
	s.at++
	var quoted strings.Builder
	for s.at < len(s.text) && s.text[s.at] != '"' {
		if s.text[s.at] == '\\' && s.at+1 < len(s.text) {
			s.at++
		}
		quoted.WriteByte(s.text[s.at])
		s.at++
	}
	s.at++
	return quoted.String()
}

func parseChallenges(headers []string) []authChallenge {
	var challenges []authChallenge
	for _, header := range headers {
		scanner := &challengeScanner{text: header}
		for {
			scanner.skip(" \t,")
			if scanner.done() {
				break
			}
			name := scanner.token()
			scanner.skip(" \t")
			if !scanner.done() && scanner.peek() == '=' && len(challenges) > 0 {
				scanner.at++
				scanner.skip(" \t")
				challenges[len(challenges)-1].params[strings.ToLower(name)] = scanner.value()
				continue
			}
			challenges = append(challenges, authChallenge{scheme: strings.ToLower(name), params: map[string]string{}})
		}
	}
	return challenges
}

type digestChallenge struct {
	params    map[string]string
	algorithm string
	qop       string
}

func pickDigestChallenge(headers []string) (digestChallenge, bool) {
	var best digestChallenge
	found := false
	for _, challenge := range parseChallenges(headers) {
		if challenge.scheme != digestScheme {
			continue
		}
		candidate := newDigestChallenge(challenge.params)
		if _, supported := candidate.hasher(); !supported {
			continue
		}
		if !found || candidate.strength() > best.strength() {
			best, found = candidate, true
		}
	}
	return best, found
}

func newDigestChallenge(params map[string]string) digestChallenge {
	algorithm := strings.ToUpper(params["algorithm"])
	if algorithm == "" {
		algorithm = digestDefaultAlg
	}
	return digestChallenge{params: params, algorithm: algorithm, qop: chooseQop(params["qop"])}
}

func (c digestChallenge) hasher() (func() hash.Hash, bool) {
	newHash, ok := digestHashes[strings.TrimSuffix(c.algorithm, digestSessionTag)]
	return newHash, ok
}

func (c digestChallenge) strength() int {
	newHash, _ := c.hasher()
	return newHash().Size()
}

func chooseQop(offered string) string {
	options := map[string]bool{}
	for _, option := range strings.Split(offered, ",") {
		options[strings.ToLower(strings.TrimSpace(option))] = true
	}
	for _, preferred := range digestQopPreference {
		if options[preferred] {
			return preferred
		}
	}
	return ""
}

func (c digestChallenge) answer(username, password, method, uri string, body []byte, cnonce string) string {
	newHash, _ := c.hasher()
	digest := func(text string) string {
		h := newHash()
		h.Write([]byte(text))
		return hex.EncodeToString(h.Sum(nil))
	}
	username, password = norm.NFC.String(username), norm.NFC.String(password)
	realm, nonce := c.params["realm"], c.params["nonce"]

	ha1 := digest(username + ":" + realm + ":" + password)
	if strings.HasSuffix(c.algorithm, digestSessionTag) {
		ha1 = digest(ha1 + ":" + nonce + ":" + cnonce)
	}
	a2 := method + ":" + uri
	if c.qop == "auth-int" {
		a2 += ":" + digest(string(body))
	}
	ha2 := digest(a2)

	response := digest(ha1 + ":" + nonce + ":" + ha2)
	if c.qop != "" {
		response = digest(ha1 + ":" + nonce + ":" + digestNonceCount + ":" + cnonce + ":" + c.qop + ":" + ha2)
	}

	userhash := strings.EqualFold(c.params["userhash"], "true")
	if userhash {
		username = digest(username + ":" + realm)
	}
	fields := []string{
		"username=" + quoteAuth(username),
		"realm=" + quoteAuth(realm),
		"nonce=" + quoteAuth(nonce),
		"uri=" + quoteAuth(uri),
	}
	if c.qop != "" {
		fields = append(fields, "qop="+c.qop, "nc="+digestNonceCount, "cnonce="+quoteAuth(cnonce))
	}
	fields = append(fields, "response="+quoteAuth(response))
	if given := c.params["algorithm"]; given != "" {
		fields = append(fields, "algorithm="+given)
	}
	if opaque, ok := c.params["opaque"]; ok {
		fields = append(fields, "opaque="+quoteAuth(opaque))
	}
	if userhash {
		fields = append(fields, "userhash=true")
	}
	return "Digest " + strings.Join(fields, ", ")
}

func quoteAuth(value string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(value) + `"`
}

func randomHex(size int) string {
	buffer := make([]byte, size)
	rand.Read(buffer)
	return hex.EncodeToString(buffer)
}
