package secrets

import (
	"fmt"
	"strings"
)

const (
	KindVault = "vault"
	KindAWS   = "aws"
	KindAzure = "azure"
	KindGCP   = "gcp"

	fieldAddress      = "address"
	fieldNamespace    = "namespace"
	fieldMount        = "mount"
	fieldKVVersion    = "kv_version"
	fieldRoleID       = "role_id"
	fieldSecretID     = "secret_id"
	fieldToken        = "token"
	fieldRegion       = "region"
	fieldAccessKey    = "access_key"
	fieldSecretKey    = "secret_key"
	fieldSessionToken = "session_token"
	fieldTenantID     = "tenant_id"
	fieldClientID     = "client_id"
	fieldClientSecret = "client_secret"
	fieldAuthority    = "authority"
	fieldProject      = "project"
)

type Field struct {
	Name     string   `json:"name"`
	Secret   bool     `json:"secret"`
	Required bool     `json:"required"`
	Env      []string `json:"-"`
}

type KindInfo struct {
	Name   string  `json:"name"`
	Fields []Field `json:"fields"`
}

type kind struct {
	info  KindInfo
	build func(Connection, *gateway) (Provider, error)
}

var catalog = []kind{
	{
		info: KindInfo{Name: KindVault, Fields: []Field{
			{Name: fieldAddress, Required: true, Env: []string{"VAULT_ADDR"}},
			{Name: fieldNamespace, Env: []string{"VAULT_NAMESPACE"}},
			{Name: fieldMount},
			{Name: fieldKVVersion},
			{Name: fieldRoleID, Env: []string{"VAULT_ROLE_ID"}},
			{Name: fieldToken, Secret: true, Env: []string{"VAULT_TOKEN"}},
			{Name: fieldSecretID, Secret: true, Env: []string{"VAULT_SECRET_ID"}},
		}},
		build: newVault,
	},
	{
		info: KindInfo{Name: KindAWS, Fields: []Field{
			{Name: fieldRegion, Required: true, Env: []string{"AWS_REGION", "AWS_DEFAULT_REGION"}},
			{Name: fieldAccessKey, Secret: true, Required: true, Env: []string{"AWS_ACCESS_KEY_ID"}},
			{Name: fieldSecretKey, Secret: true, Required: true, Env: []string{"AWS_SECRET_ACCESS_KEY"}},
			{Name: fieldSessionToken, Secret: true, Env: []string{"AWS_SESSION_TOKEN"}},
			{Name: fieldAddress},
		}},
		build: newAWS,
	},
	{
		info: KindInfo{Name: KindAzure, Fields: []Field{
			{Name: fieldAddress, Required: true, Env: []string{"AZURE_KEYVAULT_URL"}},
			{Name: fieldTenantID, Env: []string{"AZURE_TENANT_ID"}},
			{Name: fieldClientID, Env: []string{"AZURE_CLIENT_ID"}},
			{Name: fieldClientSecret, Secret: true, Env: []string{"AZURE_CLIENT_SECRET"}},
			{Name: fieldToken, Secret: true, Env: []string{"AZURE_ACCESS_TOKEN"}},
			{Name: fieldAuthority, Env: []string{"AZURE_AUTHORITY_HOST"}},
		}},
		build: newAzure,
	},
	{
		info: KindInfo{Name: KindGCP, Fields: []Field{
			{Name: fieldToken, Secret: true, Required: true, Env: []string{"GOOGLE_OAUTH_ACCESS_TOKEN", "GCP_ACCESS_TOKEN"}},
			{Name: fieldProject, Env: []string{"GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"}},
			{Name: fieldAddress},
		}},
		build: newGCP,
	},
}

func Kinds() []KindInfo {
	infos := make([]KindInfo, len(catalog))
	for i, entry := range catalog {
		infos[i] = entry.info
	}
	return infos
}

func kindNamed(name string) (kind, bool) {
	for _, entry := range catalog {
		if entry.info.Name == name {
			return entry, true
		}
	}
	return kind{}, false
}

func KindNames() string {
	names := make([]string, len(catalog))
	for i, entry := range catalog {
		names[i] = entry.info.Name
	}
	return strings.Join(names, ", ")
}

func SecretFields(kindName string) map[string]bool {
	secret := map[string]bool{}
	entry, _ := kindNamed(kindName)
	for _, field := range entry.info.Fields {
		if field.Secret {
			secret[field.Name] = true
		}
	}
	return secret
}

func readable(name string) string {
	return strings.ReplaceAll(name, "_", " ")
}

func Validate(connection Connection) error {
	entry, found := kindNamed(connection.Kind)
	if !found {
		return fmt.Errorf("unknown kind %q; choose one of %s", connection.Kind, KindNames())
	}
	if strings.TrimSpace(connection.Alias) == "" {
		return fmt.Errorf("a connection needs a name")
	}
	for _, field := range entry.info.Fields {
		if field.Required && connection.value(field.Name) == "" {
			return fmt.Errorf("connection %q needs %s", connection.Alias, readable(field.Name))
		}
	}
	return nil
}
