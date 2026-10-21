package importer

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/redact"
	"github.com/krockxz/gostman/workspace"
)

const secretsEnvironment = "Secrets"

func isPlaceholder(value string) bool {
	trimmed := strings.TrimSpace(value)
	return strings.HasPrefix(trimmed, variableOpen) && strings.HasSuffix(trimmed, variableClose) && strings.Count(trimmed, variableOpen) == 1
}

type redactor struct {
	used  map[string]bool
	names []string
	owner string
}

func (r *redactor) placeholder(field string) string {
	base := variableName(r.owner + "_" + field)
	name := base
	for attempt := 2; r.used[name]; attempt++ {
		name = fmt.Sprintf("%s_%d", base, attempt)
	}
	r.used[name] = true
	r.names = append(r.names, name)
	return variableOpen + name + variableClose
}

func (r *redactor) value(field, value string) string {
	if value == "" || isPlaceholder(value) {
		return value
	}
	return r.placeholder(field)
}

func redactSecrets(collection workspace.Collection) workspace.Collection {
	r := &redactor{used: map[string]bool{}}
	redacted := collection
	redacted.Requests = make([]workspace.Request, len(collection.Requests))
	for index, request := range collection.Requests {
		r.owner = fmt.Sprintf("R%d", index+1)
		redacted.Requests[index] = r.request(request)
	}
	redacted.Environments = r.environments(collection.Environments)
	redacted.Variables = clearSensitive(collection.Variables)
	return redacted
}

func (r *redactor) request(request workspace.Request) workspace.Request {
	request.Auth = r.auth(request.Auth)
	request.Headers = r.rows(request.Headers)
	request.QueryParams = r.rows(request.QueryParams)
	request.Vars = r.rows(request.Vars)
	request.URL = r.query(request.URL)
	if request.BodyType == bodyForm || request.BodyType == bodyMultipart {
		request.Body = r.rows(request.Body)
	}
	return request
}

func (r *redactor) auth(auth engine.Auth) engine.Auth {
	auth.Password = r.value("PASSWORD", auth.Password)
	auth.Token = r.value("TOKEN", auth.Token)
	auth.Value = r.value("VALUE", auth.Value)
	auth.OAuth2.ClientSecret = r.value("CLIENT_SECRET", auth.OAuth2.ClientSecret)
	auth.OAuth2.Password = r.value("OAUTH_PASSWORD", auth.OAuth2.Password)
	auth.OAuth2.AccessToken, auth.OAuth2.RefreshToken, auth.OAuth2.ExpiresAt = "", "", 0
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
	return rowsJSON(rows)
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
