package importer

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	secretsEnvironment = "Secrets"
	collectionOwner    = "Collection"
)

func isPlaceholder(value string) bool {
	trimmed := strings.TrimSpace(value)
	literal := strings.TrimSpace(mapPlaceholders(trimmed, func(string) string { return "" }))
	return literal != trimmed && isSchemeWord(literal)
}

func isSchemeWord(text string) bool {
	for _, r := range text {
		if !unicode.IsLetter(r) {
			return false
		}
	}
	return true
}

type redactor struct {
	used    map[string]bool
	byValue map[[2]string]string
	names   []string
	owner   string
}

func newRedactor(collection workspace.Collection) *redactor {
	r := &redactor{used: map[string]bool{}, byValue: map[[2]string]string{}}
	for _, source := range collectionVariableSources(collection) {
		var values map[string]any
		_ = json.Unmarshal([]byte(source), &values)
		for name := range values {
			r.used[strings.ToUpper(name)] = true
		}
	}
	return r
}

func collectionVariableSources(collection workspace.Collection) []string {
	sources := []string{collection.Variables}
	for _, environment := range collection.Environments {
		sources = append(sources, environment.Variables)
	}
	for _, folder := range collection.Folders {
		sources = append(sources, folder.Variables)
	}
	return sources
}

func constantName(parts ...string) string {
	var out strings.Builder
	for _, r := range strings.ToUpper(strings.Join(parts, "_")) {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			out.WriteRune(r)
		case out.Len() > 0 && !strings.HasSuffix(out.String(), "_"):
			out.WriteRune('_')
		}
	}
	name := strings.TrimSuffix(out.String(), "_")
	if name == "" || unicode.IsDigit([]rune(name)[0]) {
		return "_" + name
	}
	return name
}

func (r *redactor) freeName(field string) string {
	if name := constantName(field); !r.used[name] {
		return name
	}
	base := constantName(r.owner, field)
	name := base
	for attempt := 2; r.used[name]; attempt++ {
		name = fmt.Sprintf("%s_%d", base, attempt)
	}
	return name
}

func (r *redactor) placeholder(field, value string) string {
	key := [2]string{constantName(field), value}
	name, seen := r.byValue[key]
	if !seen {
		name = r.freeName(field)
		r.used[name] = true
		r.byValue[key] = name
		r.names = append(r.names, name)
	}
	return variableOpen + name + variableClose
}

func (r *redactor) value(field, value string) string {
	if value == "" || isPlaceholder(value) {
		return value
	}
	return r.placeholder(field, value)
}

func RedactSecrets(collection workspace.Collection) (workspace.Collection, []string) {
	r := newRedactor(collection)
	redacted := collection
	redacted.Requests = make([]workspace.Request, len(collection.Requests))
	for index, request := range collection.Requests {
		r.owner = request.Name
		redacted.Requests[index] = r.request(request)
	}
	redacted.Folders = make([]workspace.Folder, len(collection.Folders))
	for index, folder := range collection.Folders {
		r.owner = folder.Name
		folder.Settings = r.settings(folder.Settings)
		folder.Variables = clearSensitive(folder.Variables)
		redacted.Folders[index] = folder
	}
	r.owner = collectionOwner
	redacted.Settings = r.settings(collection.Settings)
	redacted.Environments = r.environments(collection.Environments)
	redacted.Variables = clearSensitive(collection.Variables)
	return redacted, r.names
}

func (r *redactor) settings(settings workspace.Settings) workspace.Settings {
	settings.Auth = r.auth(settings.Auth)
	settings.Headers = r.rows(settings.Headers)
	return settings
}

func (r *redactor) request(request workspace.Request) workspace.Request {
	request.Auth = r.auth(request.Auth)
	request.Headers = r.rows(request.Headers)
	request.QueryParams = r.rows(request.QueryParams)
	request.Vars = r.rows(request.Vars)
	request.URL = r.query(request.URL)
	switch request.BodyType {
	case bodyForm, bodyMultipart:
		request.Body = r.rows(request.Body)
	case bodyJSON:
		request.Body = r.json(request.Body)
	}
	request.GraphqlVariables = r.json(request.GraphqlVariables)
	return request
}

func (r *redactor) json(source string) string {
	var document any
	decoder := json.NewDecoder(strings.NewReader(source))
	decoder.UseNumber()
	if decoder.Decode(&document) != nil {
		return source
	}
	if !redact.MapSensitive(document, r.value) {
		return source
	}
	encoded, err := json.Marshal(document)
	if err != nil {
		return source
	}
	return string(encoded)
}

func (r *redactor) auth(auth engine.Auth) engine.Auth {
	auth.Password = r.value("PASSWORD", auth.Password)
	auth.Token = r.value("TOKEN", auth.Token)
	auth.Value = r.value("VALUE", auth.Value)
	auth.OAuth2.ClientSecret = r.value("CLIENT_SECRET", auth.OAuth2.ClientSecret)
	auth.OAuth2.Password = r.value("OAUTH_PASSWORD", auth.OAuth2.Password)
	auth.OAuth2 = auth.OAuth2.WithoutTokens()
	auth.AWS.SecretKey = r.value("SECRET_KEY", auth.AWS.SecretKey)
	auth.AWS.SessionToken = r.value("SESSION_TOKEN", auth.AWS.SessionToken)
	auth.OAuth1.ConsumerSecret = r.value("CONSUMER_SECRET", auth.OAuth1.ConsumerSecret)
	auth.OAuth1.Token = r.value("OAUTH1_TOKEN", auth.OAuth1.Token)
	auth.OAuth1.TokenSecret = r.value("TOKEN_SECRET", auth.OAuth1.TokenSecret)
	auth.OAuth1.Verifier = r.value("OAUTH1_VERIFIER", auth.OAuth1.Verifier)
	auth.OAuth1.PrivateKey = r.value("PRIVATE_KEY", auth.OAuth1.PrivateKey)
	auth.EdgeGrid.ClientToken = r.value("EDGEGRID_CLIENT_TOKEN", auth.EdgeGrid.ClientToken)
	auth.EdgeGrid.ClientSecret = r.value("EDGEGRID_SECRET", auth.EdgeGrid.ClientSecret)
	auth.EdgeGrid.AccessToken = r.value("EDGEGRID_TOKEN", auth.EdgeGrid.AccessToken)
	auth.JWT.Secret = r.value("JWT_SECRET", auth.JWT.Secret)
	auth.JWT.PrivateKey = r.value("JWT_PRIVATE_KEY", auth.JWT.PrivateKey)
	auth.ASAP.PrivateKey = r.value("ASAP_PRIVATE_KEY", auth.ASAP.PrivateKey)
	auth.Hawk.Key = r.value("HAWK_KEY", auth.Hawk.Key)
	return auth
}

func (r *redactor) rows(source string) string {
	rows := readRows(source)
	if len(rows) == 0 {
		return source
	}
	for index, candidate := range rows {
		if redact.IsSensitiveName(candidate.Key) {
			rows[index].Value = r.value(candidate.Key, candidate.Value)
		}
	}
	return jsonList(rows)
}

func (r *redactor) query(address string) string {
	base, query, found := strings.Cut(address, "?")
	if !found {
		return address
	}
	query, fragment, hasFragment := strings.Cut(query, "#")
	pairs := strings.Split(query, "&")
	for index, pair := range pairs {
		name, value, hasValue := strings.Cut(pair, "=")
		if hasValue && redact.IsSensitiveName(name) {
			pairs[index] = name + "=" + r.value(name, value)
		}
	}
	result := base + "?" + strings.Join(pairs, "&")
	if hasFragment {
		result += "#" + fragment
	}
	return result
}

func (r *redactor) environments(environments []workspace.Environment) []workspace.Environment {
	cleared := make([]workspace.Environment, len(environments))
	for index, environment := range environments {
		environment.Variables = clearSensitive(environment.Variables)
		cleared[index] = r.withPlaceholders(environment)
	}
	if len(environments) == 0 && len(r.names) > 0 {
		cleared = append(cleared, r.withPlaceholders(workspace.Environment{Id: newID(), Name: secretsEnvironment, Variables: "{}"}))
	}
	return cleared
}

func (r *redactor) withPlaceholders(environment workspace.Environment) workspace.Environment {
	values := map[string]string{}
	_ = json.Unmarshal([]byte(environment.Variables), &values)
	for _, name := range r.names {
		if _, present := values[name]; !present {
			values[name] = ""
		}
	}
	environment.Variables = objectJSON(values)
	return environment
}

func clearSensitive(source string) string {
	var values map[string]any
	if strings.TrimSpace(source) == "" || json.Unmarshal([]byte(source), &values) != nil {
		return source
	}
	for name, value := range values {
		if _, isText := value.(string); isText && redact.IsSensitiveName(name) {
			values[name] = ""
		}
	}
	encoded, err := json.Marshal(values)
	if err != nil {
		return source
	}
	return string(encoded)
}
