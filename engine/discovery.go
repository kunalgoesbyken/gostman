package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const (
	wellKnownOpenID = "/.well-known/openid-configuration"
	wellKnownOAuth  = "/.well-known/oauth-authorization-server"
)

type DiscoveryQuery struct {
	Issuer    string  `json:"issuer"`
	Variables string  `json:"variables"`
	Options   Options `json:"options"`
}

type Discovery struct {
	Issuer    string `json:"issuer"`
	AuthURL   string `json:"authUrl"`
	TokenURL  string `json:"tokenUrl"`
	DeviceURL string `json:"deviceUrl"`
	Error     string `json:"error"`
}

type providerMetadata struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	DeviceEndpoint        string `json:"device_authorization_endpoint"`
}

func Discover(ctx context.Context, query DiscoveryQuery, policy Policy) Discovery {
	issuer, err := expandedIssuer(query)
	if err != nil {
		return Discovery{Error: err.Error()}
	}
	failure := ""
	for _, candidate := range metadataAddresses(issuer) {
		found, err := fetchMetadata(ctx, candidate, query, policy)
		if err != nil {
			failure = err.Error()
			continue
		}
		return checkedDiscovery(issuer, found)
	}
	return Discovery{Error: failure}
}

func expandedIssuer(query DiscoveryQuery) (*url.URL, error) {
	expansion, err := newSubstitution(query.Variables)
	if err != nil {
		return nil, err
	}
	issuer, ok := webURL(expansion.apply(query.Issuer))
	if !ok {
		return nil, fmt.Errorf("enter the issuer of the provider, starting with https://")
	}
	issuer.RawQuery, issuer.Fragment = "", ""
	return issuer, nil
}

func metadataAddresses(issuer *url.URL) []string {
	origin := issuer.Scheme + "://" + issuer.Host
	path := strings.TrimSuffix(issuer.EscapedPath(), "/")
	addresses := []string{origin + path + wellKnownOpenID}
	if path != "" {
		addresses = append(addresses, origin+wellKnownOpenID+path)
	}
	return append(addresses, origin+wellKnownOAuth+path)
}

func fetchMetadata(ctx context.Context, address string, query DiscoveryQuery, policy Policy) (providerMetadata, error) {
	response := Send(ctx, Request{
		Method:  http.MethodGet,
		URL:     address,
		Headers: encodeRows([]row{field("Accept", contentTypeJSON)}),
		Options: Options{TimeoutMs: query.Options.TimeoutMs, InsecureTLS: query.Options.InsecureTLS},
	}, policy)
	if response.Error != "" {
		return providerMetadata{}, fmt.Errorf("%s: %s", address, response.Body)
	}
	var metadata providerMetadata
	if response.StatusCode != http.StatusOK || json.Unmarshal([]byte(response.Body), &metadata) != nil {
		return providerMetadata{}, fmt.Errorf("%s answered %s without a discovery document", address, response.Status)
	}
	return metadata, nil
}

func sameIssuer(first, second string) bool {
	return strings.TrimSuffix(first, "/") == strings.TrimSuffix(second, "/")
}

func checkedDiscovery(issuer *url.URL, metadata providerMetadata) Discovery {
	if !sameIssuer(metadata.Issuer, issuer.String()) {
		return Discovery{Error: fmt.Sprintf("the discovery document names the issuer %q instead of %q, so it was not used", metadata.Issuer, issuer.String())}
	}
	found := Discovery{
		Issuer:    metadata.Issuer,
		AuthURL:   webAddress(metadata.AuthorizationEndpoint),
		TokenURL:  webAddress(metadata.TokenEndpoint),
		DeviceURL: webAddress(metadata.DeviceEndpoint),
	}
	if found.TokenURL == "" {
		return Discovery{Error: "the discovery document has no token endpoint"}
	}
	return found
}
