package engine

import "net/url"

func signRequest(auth Auth, substitute func(string) string, method string, target *url.URL, headers []pair, body []byte) ([]pair, []byte) {
	switch auth.Type {
	case authAWSV4:
		return signSigV4(auth.AWS, substitute, method, target, headers, body), body
	case authOAuth1:
		return signOAuth1(auth.OAuth1, substitute, method, target, headers, body)
	case authEdgeGrid:
		return signEdgeGrid(auth.EdgeGrid, substitute, method, target, headers, body), body
	case authHawk:
		return signHawk(auth.Hawk, substitute, method, target, headers, body), body
	default:
		return headers, body
	}
}
