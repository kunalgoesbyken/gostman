package secrets

import (
	"context"
	"fmt"
	"strings"
)

const (
	KindVault            = "vault"
	KindAWS              = "aws"
	KindAzure            = "azure"
	KindGCP              = "gcp"
	KindKeePassXC        = "keepassxc"
	KindOnePassword      = "onepassword"
	KindBitwarden        = "bitwarden"
	KindBitwardenSecrets = "bitwarden-secrets"

	fieldAddress        = "address"
	fieldNamespace      = "namespace"
	fieldMount          = "mount"
	fieldKVVersion      = "kv_version"
	fieldRoleID         = "role_id"
	fieldSecretID       = "secret_id"
	fieldToken          = "token"
	fieldRegion         = "region"
	fieldAccessKey      = "access_key"
	fieldSecretKey      = "secret_key"
	fieldSessionToken   = "session_token"
	fieldTenantID       = "tenant_id"
	fieldClientID       = "client_id"
	fieldClientSecret   = "client_secret"
	fieldAuthority      = "authority"
	fieldProject        = "project"
	fieldAssociation    = "association"
	fieldAssociationKey = "association_key"
	fieldAccount        = "account"
	fieldSession        = "session_key"
	fieldCommand        = "command"
)

type Field struct {
	Name     string   `json:"name"`
	Secret   bool     `json:"secret"`
	Required bool     `json:"required"`
	Env      []string `json:"-"`
}

type KindInfo struct {
	Name      string  `json:"name"`
	Fields    []Field `json:"fields"`
	Versions  bool    `json:"versions"`
	Pairing   bool    `json:"pairing"`
	Unlocking bool    `json:"unlocking"`
}

type kind struct {
	info   KindInfo
	build  func(Connection, *gateway) (Provider, error)
	pair   func(context.Context) (map[string]string, error)
	unlock func(context.Context, Connection, string) (map[string]string, error)
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
		}, Versions: true},
		build: newVault,
	},
	{
		info: KindInfo{Name: KindAWS, Fields: []Field{
			{Name: fieldRegion, Required: true, Env: []string{"AWS_REGION", "AWS_DEFAULT_REGION"}},
			{Name: fieldAccessKey, Secret: true, Required: true, Env: []string{"AWS_ACCESS_KEY_ID"}},
			{Name: fieldSecretKey, Secret: true, Required: true, Env: []string{"AWS_SECRET_ACCESS_KEY"}},
			{Name: fieldSessionToken, Secret: true, Env: []string{"AWS_SESSION_TOKEN"}},
			{Name: fieldAddress},
		}, Versions: true},
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
		}, Versions: true},
		build: newAzure,
	},
	{
		info: KindInfo{Name: KindGCP, Fields: []Field{
			{Name: fieldToken, Secret: true, Required: true, Env: []string{"GOOGLE_OAUTH_ACCESS_TOKEN", "GCP_ACCESS_TOKEN"}},
			{Name: fieldProject, Env: []string{"GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"}},
			{Name: fieldAddress},
		}, Versions: true},
		build: newGCP,
	},
	{
		info: KindInfo{Name: KindOnePassword, Fields: []Field{
			{Name: fieldAccount, Env: []string{"OP_ACCOUNT"}},
			{Name: fieldToken, Secret: true, Env: []string{onePasswordTokenEnv}},
			{Name: fieldCommand},
		}},
		build: newOnePassword,
	},
	{
		info: KindInfo{Name: KindBitwarden, Fields: []Field{
			{Name: fieldSession, Secret: true, Required: true, Env: []string{bitwardenSessionEnv}},
			{Name: fieldCommand},
		}},
		build:  newBitwarden,
		unlock: unlockBitwarden,
	},
	{
		info: KindInfo{Name: KindBitwardenSecrets, Fields: []Field{
			{Name: fieldToken, Secret: true, Required: true, Env: []string{bwsTokenEnv}},
			{Name: fieldAddress, Env: []string{bwsServerEnv}},
			{Name: fieldCommand},
		}},
		build: newBWS,
	},
	{
		info: KindInfo{Name: KindKeePassXC, Fields: []Field{
			{Name: fieldAssociation, Required: true},
			{Name: fieldAssociationKey, Secret: true, Required: true},
		}},
		build: newKeePassXC,
		pair:  pairKeePassXC,
	},
}

func Kinds() []KindInfo {
	infos := make([]KindInfo, len(catalog))
	for i, entry := range catalog {
		infos[i] = entry.info
		infos[i].Pairing = entry.pair != nil
		infos[i].Unlocking = entry.unlock != nil
	}
	return infos
}

func Pair(ctx context.Context, kindName string) (map[string]string, error) {
	entry, found := kindNamed(kindName)
	if !found || entry.pair == nil {
		return nil, fmt.Errorf("%q connections are not set up by connecting to an app", kindName)
	}
	return entry.pair(ctx)
}

func Unlock(ctx context.Context, connection Connection, password string) (map[string]string, error) {
	entry, found := kindNamed(connection.Kind)
	if !found || entry.unlock == nil {
		return nil, fmt.Errorf("%q connections are not unlocked with a password", connection.Kind)
	}
	return entry.unlock(ctx, connection, password)
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
