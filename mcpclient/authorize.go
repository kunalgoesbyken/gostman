package mcpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/loopback"
	"github.com/kunalgoesbyken/gostman/mcp"
)

const (
	StepProbe        = "probe"
	StepChallenge    = "challenge"
	StepResource     = "resource"
	StepServer       = "server"
	StepRegistration = "registration"

	OutcomeOK      = "ok"
	OutcomeWarning = "warning"
	OutcomeFailed  = "failed"
	OutcomeStopped = "stopped"

	ProblemLocalCommand      = "localCommand"
	ProblemUnreachable       = "unreachable"
	ProblemNoChallenge       = "noResourceMetadata"
	ProblemNotProtected      = "notProtected"
	ProblemAnswered          = "answered"
	ProblemMetadataMissing   = "resourceMetadataMissing"
	ProblemMetadataInvalid   = "resourceMetadataInvalid"
	ProblemResourceMismatch  = "resourceMismatch"
	ProblemServerMissing     = "serverMetadataMissing"
	ProblemIssuerMismatch    = "issuerMismatch"
	ProblemServerIncomplete  = "serverMetadataIncomplete"
	ProblemNoPKCE            = "noPkce"
	ProblemInsecureEndpoint  = "insecureEndpoint"
	ProblemInsufficientScope = "insufficientScope"
	ProblemNoRegistration    = "noRegistration"
	ProblemRegistration      = "registrationRefused"
	ProblemServerChanged     = "serverChanged"

	wellKnownResource = "/.well-known/oauth-protected-resource"
	wellKnownOAuth    = "/.well-known/oauth-authorization-server"
	wellKnownOpenID   = "/.well-known/openid-configuration"

	headerAuthenticate = "WWW-Authenticate"
	schemeBearer       = "bearer"
	paramMetadata      = "resource_metadata"
	paramScope         = "scope"
	paramError         = "error"
	errorScope         = "insufficient_scope"
	scopeOffline       = "offline_access"
	challengeS256      = "S256"
	credentialsInBody  = "body"
	authBasic          = "client_secret_basic"
	authNone           = "none"
	applicationNative  = "native"
	applicationWeb     = "web"
	grantRefresh       = "refresh_token"
	responseCode       = "code"
	maxMetadataBytes   = 1 << 20
)

type AuthQuery struct {
	Target            Target `json:"target"`
	RedirectURI       string `json:"redirectUri"`
	ClientMetadataURL string `json:"clientMetadataUrl"`
	Native            bool   `json:"native"`
}

type AuthAttempt struct {
	URL    string `json:"url"`
	Status int    `json:"status,omitempty"`
	Error  string `json:"error,omitempty"`
}

type AuthStep struct {
	Step     string        `json:"step"`
	Outcome  string        `json:"outcome"`
	Problem  string        `json:"problem,omitempty"`
	Detail   string        `json:"detail,omitempty"`
	Attempts []AuthAttempt `json:"attempts,omitempty"`
}

type AuthPlan struct {
	Steps          []AuthStep    `json:"steps"`
	Ready          bool          `json:"ready"`
	Config         engine.OAuth2 `json:"config"`
	IssuerRequired bool          `json:"issuerRequired"`
}

type challenge struct {
	scheme string
	params map[string]string
}

type resourceMetadata struct {
	Resource             string   `json:"resource"`
	AuthorizationServers []string `json:"authorization_servers"`
	ScopesSupported      []string `json:"scopes_supported"`
}

type serverMetadata struct {
	Issuer                  string   `json:"issuer"`
	AuthorizationEndpoint   string   `json:"authorization_endpoint"`
	TokenEndpoint           string   `json:"token_endpoint"`
	RegistrationEndpoint    string   `json:"registration_endpoint"`
	ScopesSupported         []string `json:"scopes_supported"`
	CodeChallengeMethods    []string `json:"code_challenge_methods_supported"`
	IssParameterSupported   bool     `json:"authorization_response_iss_parameter_supported"`
	ClientMetadataDocuments bool     `json:"client_id_metadata_document_supported"`
}

type registrationRequest struct {
	ClientName              string   `json:"client_name"`
	RedirectURIs            []string `json:"redirect_uris"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	ApplicationType         string   `json:"application_type"`
	Scope                   string   `json:"scope,omitempty"`
}

type registrationAnswer struct {
	ClientID                string `json:"client_id"`
	ClientSecret            string `json:"client_secret"`
	TokenEndpointAuthMethod string `json:"token_endpoint_auth_method"`
	Error                   string `json:"error"`
	ErrorDescription        string `json:"error_description"`
}

type fetched struct {
	attempt AuthAttempt
	header  http.Header
	body    []byte
}

type discovery struct {
	ctx      context.Context
	client   *http.Client
	query    AuthQuery
	current  engine.OAuth2
	server   *url.URL
	located  string
	plan     AuthPlan
	scope    string
	stepUp   bool
	resource resourceMetadata
	metadata serverMetadata
}

func DiscoverAuthorization(ctx context.Context, query AuthQuery, policy engine.Policy) AuthPlan {
	ctx, cancel := context.WithTimeout(ctx, policy.Timeout(query.Target.Options))
	defer cancel()
	d := &discovery{
		ctx:     ctx,
		client:  &http.Client{Transport: policy.Transport(query.Target.Options.InsecureTLS)},
		query:   query,
		current: query.Target.Auth.OAuth2,
		plan:    AuthPlan{Steps: []AuthStep{}},
	}
	d.run()
	return d.plan
}

func (d *discovery) record(step AuthStep) bool {
	d.plan.Steps = append(d.plan.Steps, step)
	return step.Outcome == OutcomeOK || step.Outcome == OutcomeWarning
}

func (d *discovery) run() {
	steps := []func() bool{d.probe, d.findResourceMetadata, d.findServerMetadata, d.register}
	for _, step := range steps {
		if !step() {
			return
		}
	}
	d.plan.Ready = true
}

func (d *discovery) probe() bool {
	if IsCommand(d.query.Target.URL) {
		return d.record(AuthStep{Step: StepProbe, Outcome: OutcomeFailed, Problem: ProblemLocalCommand})
	}
	prepared, err := prepareHTTP(d.query.Target)
	if err != nil {
		return d.record(AuthStep{Step: StepProbe, Outcome: OutcomeFailed, Problem: ProblemUnreachable, Detail: err.Error()})
	}
	d.server, err = url.Parse(prepared.URL)
	if err != nil || d.server.Host == "" {
		return d.record(AuthStep{Step: StepProbe, Outcome: OutcomeFailed, Problem: ProblemUnreachable, Detail: "the server URL cannot be read"})
	}
	answered, err := d.post(prepared)
	step := AuthStep{Step: StepProbe, Outcome: OutcomeOK, Attempts: []AuthAttempt{answered.attempt}}
	if err != nil {
		step.Outcome, step.Problem, step.Detail = OutcomeFailed, ProblemUnreachable, err.Error()
		return d.record(step)
	}
	status := answered.attempt.Status
	if status != http.StatusUnauthorized && status != http.StatusForbidden {
		step.Problem = ProblemAnswered
		return d.record(step)
	}
	d.record(step)
	return d.readChallenge(status, answered.header.Values(headerAuthenticate))
}

func (d *discovery) post(prepared engine.Prepared) (fetched, error) {
	probe := &session{modern: true, version: ModernVersion}
	unanswered := fetched{attempt: AuthAttempt{URL: prepared.URL}}
	params, err := probe.params(MethodDiscover, nil)
	if err != nil {
		return unanswered, err
	}
	encoded, err := json.Marshal(mcp.Message{Version: mcp.JSONRPCVersion, ID: json.RawMessage("1"), Method: MethodDiscover, Params: params})
	if err != nil {
		return unanswered, err
	}
	request, err := http.NewRequestWithContext(d.ctx, http.MethodPost, prepared.URL, bytes.NewReader(encoded))
	if err != nil {
		return unanswered, err
	}
	link := httpLink{headers: prepared.Headers, version: ModernVersion}
	request.Header = link.header(probe.header(rpc{method: MethodDiscover}))
	return d.exchange(request)
}

func (d *discovery) exchange(request *http.Request) (fetched, error) {
	result := fetched{attempt: AuthAttempt{URL: request.URL.String()}}
	response, err := d.client.Do(request)
	if err != nil {
		result.attempt.Error = err.Error()
		return result, err
	}
	defer response.Body.Close()
	result.attempt.Status = response.StatusCode
	result.header = response.Header
	result.body, err = io.ReadAll(io.LimitReader(response.Body, maxMetadataBytes))
	return result, err
}

func (d *discovery) get(address string) (fetched, error) {
	request, err := http.NewRequestWithContext(d.ctx, http.MethodGet, address, nil)
	if err != nil {
		return fetched{attempt: AuthAttempt{URL: address, Error: err.Error()}}, err
	}
	request.Header.Set(headerAccept, typeJSON)
	return d.exchange(request)
}

func (d *discovery) readChallenge(status int, values []string) bool {
	bearer := findChallenge(parseChallenges(values), schemeBearer)
	step := AuthStep{Step: StepChallenge, Outcome: OutcomeOK, Detail: strings.Join(values, "\n")}
	d.scope = bearer.params[paramScope]
	if status == http.StatusForbidden && bearer.params[paramError] == errorScope {
		d.stepUp = true
		d.scope = unionScopes(d.current.Scope, d.scope)
		step.Problem = ProblemInsufficientScope
	}
	if bearer.params[paramMetadata] == "" {
		step.Outcome, step.Problem = OutcomeWarning, ProblemNoChallenge
	}
	d.located = bearer.params[paramMetadata]
	return d.record(step)
}

func (d *discovery) resourceCandidates() []string {
	if d.located != "" {
		return []string{d.located}
	}
	origin := d.server.Scheme + "://" + d.server.Host
	path := strings.TrimSuffix(d.server.EscapedPath(), "/")
	if path == "" {
		return []string{origin + wellKnownResource}
	}
	return []string{origin + wellKnownResource + path, origin + wellKnownResource}
}

func (d *discovery) firstDocument(candidates []string, accept func([]byte) bool) (AuthStep, []byte) {
	step := AuthStep{Outcome: OutcomeFailed}
	for _, candidate := range candidates {
		answered, err := d.get(candidate)
		step.Attempts = append(step.Attempts, answered.attempt)
		if err == nil && answered.attempt.Status == http.StatusOK && accept(answered.body) {
			step.Outcome = OutcomeOK
			return step, answered.body
		}
	}
	return step, nil
}

func isJSONObject(body []byte) bool {
	var object map[string]json.RawMessage
	return json.Unmarshal(body, &object) == nil && object != nil
}

func (d *discovery) findResourceMetadata() bool {
	notProtected := d.lastProblem() == ProblemAnswered
	step, body := d.firstDocument(d.resourceCandidates(), isJSONObject)
	step.Step = StepResource
	if body == nil {
		step.Problem = ProblemMetadataMissing
		if notProtected {
			step.Outcome, step.Problem = OutcomeStopped, ProblemNotProtected
		}
		return d.record(step)
	}
	var metadata resourceMetadata
	json.Unmarshal(body, &metadata)
	d.resource = metadata
	step.Detail = string(body)
	switch {
	case len(metadata.AuthorizationServers) == 0:
		step.Outcome, step.Problem = OutcomeFailed, ProblemMetadataInvalid
	case metadata.Resource != "" && !coversServer(d.server, metadata.Resource):
		step.Outcome, step.Problem = OutcomeFailed, ProblemResourceMismatch
		step.Detail = fmt.Sprintf("resource %q, server %q", metadata.Resource, d.server.String())
	}
	if d.scope == "" {
		d.scope = strings.Join(metadata.ScopesSupported, " ")
	}
	return d.record(step)
}

func (d *discovery) lastProblem() string {
	return d.plan.Steps[len(d.plan.Steps)-1].Problem
}

func serverCandidates(issuer string) []string {
	parsed, err := url.Parse(issuer)
	if err != nil || parsed.Host == "" {
		return nil
	}
	origin := parsed.Scheme + "://" + parsed.Host
	path := strings.TrimSuffix(parsed.EscapedPath(), "/")
	if path == "" {
		return []string{origin + wellKnownOAuth, origin + wellKnownOpenID}
	}
	return []string{origin + wellKnownOAuth + path, origin + wellKnownOpenID + path, origin + path + wellKnownOpenID}
}

func (d *discovery) findServerMetadata() bool {
	issuer := d.resource.AuthorizationServers[0]
	mismatch := ""
	accept := func(body []byte) bool {
		var metadata serverMetadata
		if json.Unmarshal(body, &metadata) != nil {
			return false
		}
		if metadata.Issuer != issuer {
			mismatch = metadata.Issuer
			return false
		}
		d.metadata = metadata
		return true
	}
	step, body := d.firstDocument(serverCandidates(issuer), accept)
	step.Step = StepServer
	if body == nil {
		step.Problem = ProblemServerMissing
		if mismatch != "" {
			step.Problem = ProblemIssuerMismatch
			step.Detail = fmt.Sprintf("expected %q, found %q", issuer, mismatch)
		}
		return d.record(step)
	}
	step.Detail = string(body)
	switch {
	case d.metadata.AuthorizationEndpoint == "" || d.metadata.TokenEndpoint == "":
		step.Outcome, step.Problem = OutcomeFailed, ProblemServerIncomplete
	case !slices.Contains(d.metadata.CodeChallengeMethods, challengeS256):
		step.Outcome, step.Problem = OutcomeFailed, ProblemNoPKCE
	case !isSecure(d.metadata.AuthorizationEndpoint) || !isSecure(d.metadata.TokenEndpoint):
		step.Outcome, step.Problem = OutcomeWarning, ProblemInsecureEndpoint
	}
	return d.record(step)
}

func (d *discovery) register() bool {
	step := AuthStep{Step: StepRegistration, Outcome: OutcomeOK}
	config := engine.OAuth2{ClientID: d.current.ClientID, ClientSecret: d.current.ClientSecret, CredentialsIn: d.current.CredentialsIn}
	sameServer := d.current.Issuer == "" || d.current.Issuer == d.metadata.Issuer
	switch {
	case config.ClientID != "" && sameServer:
		step.Detail = config.ClientID
	case d.metadata.ClientMetadataDocuments && d.query.ClientMetadataURL != "":
		config = engine.OAuth2{ClientID: d.query.ClientMetadataURL, CredentialsIn: credentialsInBody}
		step.Detail = config.ClientID
	case d.metadata.RegistrationEndpoint != "":
		registered, attempt, problem := d.registerClient()
		step.Attempts = []AuthAttempt{attempt}
		if problem != "" {
			step.Outcome, step.Problem, step.Detail = OutcomeFailed, ProblemRegistration, problem
			return d.record(step)
		}
		config = registered
		step.Detail = config.ClientID
	default:
		step.Outcome, step.Problem = OutcomeFailed, ProblemNoRegistration
		return d.record(step)
	}
	if !sameServer && step.Problem == "" {
		step.Outcome, step.Problem = OutcomeWarning, ProblemServerChanged
	}
	d.plan.Config = d.configWith(config)
	d.plan.IssuerRequired = d.metadata.IssParameterSupported
	return d.record(step)
}

func (d *discovery) registerClient() (engine.OAuth2, AuthAttempt, string) {
	application := applicationWeb
	if d.query.Native {
		application = applicationNative
	}
	payload, err := json.Marshal(registrationRequest{
		ClientName:              clientName,
		RedirectURIs:            []string{d.query.RedirectURI},
		GrantTypes:              []string{engine.GrantAuthorizationCode, grantRefresh},
		ResponseTypes:           []string{responseCode},
		TokenEndpointAuthMethod: authNone,
		ApplicationType:         application,
		Scope:                   d.scope,
	})
	if err != nil {
		return engine.OAuth2{}, AuthAttempt{URL: d.metadata.RegistrationEndpoint}, err.Error()
	}
	request, err := http.NewRequestWithContext(d.ctx, http.MethodPost, d.metadata.RegistrationEndpoint, bytes.NewReader(payload))
	if err != nil {
		return engine.OAuth2{}, AuthAttempt{URL: d.metadata.RegistrationEndpoint}, err.Error()
	}
	request.Header.Set(headerContentType, typeJSON)
	request.Header.Set(headerAccept, typeJSON)
	answered, err := d.exchange(request)
	if err != nil {
		return engine.OAuth2{}, answered.attempt, err.Error()
	}
	var registered registrationAnswer
	json.Unmarshal(answered.body, &registered)
	if answered.attempt.Status >= http.StatusMultipleChoices || registered.ClientID == "" {
		return engine.OAuth2{}, answered.attempt, registrationFailure(registered, answered)
	}
	credentials := credentialsInBody
	if registered.TokenEndpointAuthMethod == authBasic {
		credentials = ""
	}
	return engine.OAuth2{ClientID: registered.ClientID, ClientSecret: registered.ClientSecret, CredentialsIn: credentials}, answered.attempt, ""
}

func registrationFailure(registered registrationAnswer, answered fetched) string {
	switch {
	case registered.ErrorDescription != "":
		return registered.Error + ": " + registered.ErrorDescription
	case registered.Error != "":
		return registered.Error
	default:
		return strings.TrimSpace(strings.ToValidUTF8(string(answered.body), "�"))
	}
}

func (d *discovery) configWith(client engine.OAuth2) engine.OAuth2 {
	scope := d.scope
	if slices.Contains(d.metadata.ScopesSupported, scopeOffline) {
		scope = unionScopes(scope, scopeOffline)
	}
	resource := d.resource.Resource
	if resource == "" {
		resource = canonicalResource(d.server)
	}
	return engine.OAuth2{
		Grant:         engine.GrantAuthorizationCode,
		AuthURL:       d.metadata.AuthorizationEndpoint,
		TokenURL:      d.metadata.TokenEndpoint,
		ClientID:      client.ClientID,
		ClientSecret:  client.ClientSecret,
		Scope:         scope,
		CallbackURL:   d.query.RedirectURI,
		CredentialsIn: client.CredentialsIn,
		PKCE:          true,
		HeaderPrefix:  d.current.HeaderPrefix,
		Resource:      resource,
		Issuer:        d.metadata.Issuer,
	}
}

func parseChallenges(values []string) []challenge {
	var challenges []challenge
	for _, value := range values {
		scanner := challengeScanner{text: value}
		for scanner.more() {
			name := scanner.token()
			if name == "" {
				scanner.skip()
				continue
			}
			if !scanner.consume('=') {
				challenges = append(challenges, challenge{scheme: strings.ToLower(name), params: map[string]string{}})
				continue
			}
			parameter := scanner.value()
			if len(challenges) > 0 {
				challenges[len(challenges)-1].params[strings.ToLower(name)] = parameter
			}
		}
	}
	return challenges
}

func findChallenge(challenges []challenge, scheme string) challenge {
	for _, candidate := range challenges {
		if candidate.scheme == scheme {
			return candidate
		}
	}
	return challenge{params: map[string]string{}}
}

type challengeScanner struct {
	text     string
	position int
}

func (s *challengeScanner) skipSeparators() {
	for s.position < len(s.text) && strings.IndexByte(" \t,", s.text[s.position]) >= 0 {
		s.position++
	}
}

func (s *challengeScanner) more() bool {
	s.skipSeparators()
	return s.position < len(s.text)
}

func (s *challengeScanner) skip() {
	s.position++
}

func (s *challengeScanner) token() string {
	start := s.position
	for s.position < len(s.text) && isToken(s.text[s.position:s.position+1]) {
		s.position++
	}
	return s.text[start:s.position]
}

func (s *challengeScanner) consume(expected byte) bool {
	look := s.position
	for look < len(s.text) && (s.text[look] == ' ' || s.text[look] == '\t') {
		look++
	}
	if look < len(s.text) && s.text[look] == expected && !s.isToken68Padding(look) {
		s.position = look + 1
		return true
	}
	return false
}

func (s *challengeScanner) isToken68Padding(at int) bool {
	next := at + 1
	return next >= len(s.text) || s.text[next] == '=' || s.text[next] == ','
}

func (s *challengeScanner) value() string {
	for s.position < len(s.text) && (s.text[s.position] == ' ' || s.text[s.position] == '\t') {
		s.position++
	}
	if s.position >= len(s.text) || s.text[s.position] != '"' {
		return s.token()
	}
	s.position++
	var quoted strings.Builder
	for s.position < len(s.text) && s.text[s.position] != '"' {
		if s.text[s.position] == '\\' && s.position+1 < len(s.text) {
			s.position++
		}
		quoted.WriteByte(s.text[s.position])
		s.position++
	}
	s.position++
	return quoted.String()
}

func unionScopes(first, second string) string {
	var scopes []string
	for _, scope := range append(strings.Fields(first), strings.Fields(second)...) {
		if !slices.Contains(scopes, scope) {
			scopes = append(scopes, scope)
		}
	}
	return strings.Join(scopes, " ")
}

func coversServer(server *url.URL, resource string) bool {
	parsed, err := url.Parse(resource)
	if err != nil || !strings.EqualFold(parsed.Scheme, server.Scheme) || !strings.EqualFold(parsed.Host, server.Host) {
		return false
	}
	prefix := strings.TrimSuffix(parsed.Path, "/")
	return prefix == "" || server.Path == prefix || strings.HasPrefix(server.Path, prefix+"/")
}

func canonicalResource(server *url.URL) string {
	canonical := url.URL{Scheme: strings.ToLower(server.Scheme), Host: strings.ToLower(server.Host), Path: server.Path, RawPath: server.RawPath, RawQuery: server.RawQuery}
	if canonical.Path == "/" {
		canonical.Path = ""
	}
	return canonical.String()
}

func isSecure(address string) bool {
	parsed, err := url.Parse(address)
	if err != nil {
		return false
	}
	if parsed.Scheme == "https" {
		return true
	}
	return loopback.IsHost(parsed.Hostname())
}
