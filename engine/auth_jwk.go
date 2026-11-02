package engine

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
)

type jsonWebKey struct {
	Type  string `json:"kty"`
	KeyID string `json:"kid"`
	Curve string `json:"crv"`
	N     string `json:"n"`
	E     string `json:"e"`
	D     string `json:"d"`
	P     string `json:"p"`
	Q     string `json:"q"`
	X     string `json:"x"`
	Y     string `json:"y"`
}

var jwkCurves = map[string]elliptic.Curve{
	"P-256": elliptic.P256(),
	"P-384": elliptic.P384(),
	"P-521": elliptic.P521(),
}

func jwtClaims(payload, expiry string) ([]byte, error) {
	if strings.TrimSpace(expiry) == "" {
		return jsonObjectText(payload, "the payload")
	}
	lifetime, err := asapLifetime(expiry)
	if err != nil {
		return nil, err
	}
	claims, err := jsonObject(payload, "the payload")
	if err != nil {
		return nil, err
	}
	now := clock()
	if _, set := claims["iat"]; !set {
		claims["iat"] = now.Unix()
	}
	if _, set := claims["exp"]; !set {
		claims["exp"] = now.Add(lifetime).Unix()
	}
	return json.Marshal(claims)
}

func jwkKeyID(text string) string {
	var key jsonWebKey
	if err := json.Unmarshal([]byte(strings.TrimSpace(text)), &key); err != nil {
		return ""
	}
	return key.KeyID
}

func parseJWK(text string) (crypto.Signer, error) {
	var key jsonWebKey
	if err := json.Unmarshal([]byte(strings.TrimSpace(text)), &key); err != nil {
		return nil, fmt.Errorf("the private key looks like a JWK but is not valid JSON")
	}
	if key.D == "" {
		return nil, fmt.Errorf("the JWK has no private part (d); a public key cannot sign")
	}
	switch key.Type {
	case "RSA":
		return key.rsaKey()
	case "EC":
		return key.ecKey()
	}
	return nil, fmt.Errorf("the JWK type %q is not supported; use RSA or EC", key.Type)
}

func jwkNumber(label, value string) (*big.Int, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(value, "="))
	if err != nil || len(raw) == 0 {
		return nil, fmt.Errorf("the JWK member %s is missing or not base64url", label)
	}
	return new(big.Int).SetBytes(raw), nil
}

func (k jsonWebKey) rsaKey() (*rsa.PrivateKey, error) {
	var numbers [5]*big.Int
	for index, member := range []struct{ label, value string }{{"n", k.N}, {"e", k.E}, {"d", k.D}, {"p", k.P}, {"q", k.Q}} {
		number, err := jwkNumber(member.label, member.value)
		if err != nil {
			return nil, err
		}
		numbers[index] = number
	}
	private := &rsa.PrivateKey{
		PublicKey: rsa.PublicKey{N: numbers[0], E: int(numbers[1].Int64())},
		D:         numbers[2],
		Primes:    []*big.Int{numbers[3], numbers[4]},
	}
	if err := private.Validate(); err != nil {
		return nil, fmt.Errorf("the JWK is not a valid RSA key: %w", err)
	}
	private.Precompute()
	return private, nil
}

func (k jsonWebKey) ecKey() (*ecdsa.PrivateKey, error) {
	curve, known := jwkCurves[k.Curve]
	if !known {
		return nil, fmt.Errorf("the JWK curve %q is not supported; use P-256, P-384 or P-521", k.Curve)
	}
	x, err := jwkNumber("x", k.X)
	if err != nil {
		return nil, err
	}
	y, err := jwkNumber("y", k.Y)
	if err != nil {
		return nil, err
	}
	d, err := jwkNumber("d", k.D)
	if err != nil {
		return nil, err
	}
	return &ecdsa.PrivateKey{PublicKey: ecdsa.PublicKey{Curve: curve, X: x, Y: y}, D: d}, nil
}
