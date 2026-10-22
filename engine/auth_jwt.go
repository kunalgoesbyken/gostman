package engine

import (
	"bytes"
	"crypto"
	"crypto/ecdsa"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	_ "crypto/sha256"
	_ "crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	authJWT  = "jwt"
	authASAP = "asap"

	jwtInQuery         = "query"
	jwtDefaultPrefix   = "Bearer"
	jwtDefaultQueryKey = "token"
	jwtSecretBase64    = "base64"
	jwtDefaultHMAC     = "HS256"
	jwtDefaultSigned   = "RS256"
	asapDefaultExpiry  = time.Hour

	jwtLabel  = "JWT Bearer"
	asapLabel = "ASAP"
)

type JWTAuth struct {
	Algorithm      string `json:"algorithm"`
	Secret         string `json:"secret"`
	SecretEncoding string `json:"secretEncoding"`
	PrivateKey     string `json:"privateKey"`
	Payload        string `json:"payload"`
	Header         string `json:"header"`
	In             string `json:"in"`
	Prefix         string `json:"prefix"`
	QueryKey       string `json:"queryKey"`
}

type ASAPAuth struct {
	Algorithm  string `json:"algorithm"`
	Issuer     string `json:"issuer"`
	Subject    string `json:"subject"`
	Audience   string `json:"audience"`
	KeyID      string `json:"keyId"`
	PrivateKey string `json:"privateKey"`
	Claims     string `json:"claims"`
	Expiry     string `json:"expiry"`
}

type jwtFamily int

const (
	familyHMAC jwtFamily = iota
	familyRSA
	familyPSS
	familyECDSA
)

type jwtAlgorithm struct {
	family jwtFamily
	hash   crypto.Hash
}

var jwtAlgorithms = map[string]jwtAlgorithm{
	"HS256": {familyHMAC, crypto.SHA256},
	"HS384": {familyHMAC, crypto.SHA384},
	"HS512": {familyHMAC, crypto.SHA512},
	"RS256": {familyRSA, crypto.SHA256},
	"RS384": {familyRSA, crypto.SHA384},
	"RS512": {familyRSA, crypto.SHA512},
	"PS256": {familyPSS, crypto.SHA256},
	"PS384": {familyPSS, crypto.SHA384},
	"PS512": {familyPSS, crypto.SHA512},
	"ES256": {familyECDSA, crypto.SHA256},
	"ES384": {familyECDSA, crypto.SHA384},
	"ES512": {familyECDSA, crypto.SHA512},
}

func applyJWT(config JWTAuth, substitute func(string) string, headers []pair, target *url.URL) ([]pair, error) {
	name := algorithmName(substitute(config.Algorithm), jwtDefaultHMAC)
	claims, err := jsonObjectText(substitute(config.Payload), "the payload")
	if err != nil {
		return headers, err
	}
	extra, err := jsonObject(substitute(config.Header), "the extra header fields")
	if err != nil {
		return headers, err
	}
	secret, err := jwtSecret(substitute(config.Secret), config.SecretEncoding)
	if err != nil {
		return headers, err
	}
	token, err := signJWT(name, extra, claims, secret, substitute(config.PrivateKey))
	if err != nil {
		return headers, err
	}
	if config.In == jwtInQuery {
		key := strings.TrimSpace(substitute(config.QueryKey))
		if key == "" {
			key = jwtDefaultQueryKey
		}
		overrideQuery(target, []pair{{key, token}})
		return headers, nil
	}
	prefix := strings.TrimSpace(substitute(config.Prefix))
	if prefix == "" {
		prefix = jwtDefaultPrefix
	}
	return setHeader(headers, headerAuthorization, prefix+" "+token), nil
}

func applyASAP(config ASAPAuth, substitute func(string) string, headers []pair) ([]pair, error) {
	name := algorithmName(substitute(config.Algorithm), jwtDefaultSigned)
	if jwtAlgorithms[name].family == familyHMAC {
		return headers, fmt.Errorf("tokens are signed with a private key, so choose an RS, PS or ES algorithm")
	}
	issuer, audience, keyID := strings.TrimSpace(substitute(config.Issuer)), strings.TrimSpace(substitute(config.Audience)), strings.TrimSpace(substitute(config.KeyID))
	if issuer == "" || audience == "" || keyID == "" {
		return headers, fmt.Errorf("an issuer, an audience and a key ID are required")
	}
	lifetime, err := asapLifetime(substitute(config.Expiry))
	if err != nil {
		return headers, err
	}
	claims, err := jsonObject(substitute(config.Claims), "the additional claims")
	if err != nil {
		return headers, err
	}
	now := clock()
	claims["iss"], claims["aud"], claims["jti"] = issuer, audience, newGUID()
	claims["iat"], claims["exp"] = now.Unix(), now.Add(lifetime).Unix()
	if subject := strings.TrimSpace(substitute(config.Subject)); subject != "" {
		claims["sub"] = subject
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return headers, err
	}
	token, err := signJWT(name, map[string]any{"kid": keyID}, payload, nil, substitute(config.PrivateKey))
	if err != nil {
		return headers, err
	}
	return setHeader(headers, headerAuthorization, jwtDefaultPrefix+" "+token), nil
}

func labelled(label string) func([]pair, error) ([]pair, error) {
	return func(headers []pair, err error) ([]pair, error) {
		if err != nil {
			return headers, fmt.Errorf("%s: %w", label, err)
		}
		return headers, nil
	}
}

func algorithmName(value, fallback string) string {
	name := strings.ToUpper(strings.TrimSpace(value))
	if name == "" {
		return fallback
	}
	return name
}

func asapLifetime(value string) (time.Duration, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return asapDefaultExpiry, nil
	}
	if seconds, err := strconv.Atoi(value); err == nil && seconds > 0 {
		return time.Duration(seconds) * time.Second, nil
	}
	if lifetime, err := time.ParseDuration(value); err == nil && lifetime > 0 {
		return lifetime, nil
	}
	return 0, fmt.Errorf("the expiry %q is not a number of seconds or a duration such as 1h", value)
}

func jwtSecret(secret, encoding string) ([]byte, error) {
	if encoding != jwtSecretBase64 {
		return []byte(secret), nil
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(secret))
	if err != nil {
		decoded, err = base64.RawURLEncoding.DecodeString(strings.TrimRight(strings.TrimSpace(secret), "="))
	}
	if err != nil {
		return nil, fmt.Errorf("the secret is not valid base64")
	}
	return decoded, nil
}

func jsonObjectText(text, label string) ([]byte, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return []byte("{}"), nil
	}
	if _, err := jsonObject(text, label); err != nil {
		return nil, err
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, []byte(text)); err != nil {
		return nil, fmt.Errorf("%s is not valid JSON: %w", label, err)
	}
	return compact.Bytes(), nil
}

func jsonObject(text, label string) (map[string]any, error) {
	object := map[string]any{}
	if strings.TrimSpace(text) == "" {
		return object, nil
	}
	decoder := json.NewDecoder(strings.NewReader(text))
	decoder.UseNumber()
	if err := decoder.Decode(&object); err != nil || object == nil {
		return nil, fmt.Errorf("%s must be a JSON object", label)
	}
	if decoder.More() {
		return nil, fmt.Errorf("%s must be a single JSON object", label)
	}
	return object, nil
}

func signJWT(name string, header map[string]any, payload []byte, secret []byte, privateKey string) (string, error) {
	algorithm, ok := jwtAlgorithms[name]
	if !ok {
		return "", fmt.Errorf("unsupported algorithm %q", name)
	}
	header["alg"] = name
	if _, set := header["typ"]; !set {
		header["typ"] = "JWT"
	}
	encodedHeader, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	input := base64.RawURLEncoding.EncodeToString(encodedHeader) + "." + base64.RawURLEncoding.EncodeToString(payload)
	signature, err := jwtSignature(algorithm, input, secret, privateKey)
	if err != nil {
		return "", err
	}
	return input + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func jwtSignature(algorithm jwtAlgorithm, input string, secret []byte, privateKey string) ([]byte, error) {
	if algorithm.family == familyHMAC {
		mac := hmac.New(algorithm.hash.New, secret)
		mac.Write([]byte(input))
		return mac.Sum(nil), nil
	}
	key, err := parsePrivateKey(privateKey)
	if err != nil {
		return nil, err
	}
	hasher := algorithm.hash.New()
	hasher.Write([]byte(input))
	digest := hasher.Sum(nil)
	switch algorithm.family {
	case familyRSA, familyPSS:
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("RS and PS algorithms need an RSA private key")
		}
		if algorithm.family == familyPSS {
			return rsa.SignPSS(rand.Reader, rsaKey, algorithm.hash, digest, &rsa.PSSOptions{SaltLength: rsa.PSSSaltLengthEqualsHash})
		}
		return rsa.SignPKCS1v15(rand.Reader, rsaKey, algorithm.hash, digest)
	default:
		ecKey, ok := key.(*ecdsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("ES algorithms need an EC private key")
		}
		r, s, err := ecdsa.Sign(rand.Reader, ecKey, digest)
		if err != nil {
			return nil, err
		}
		size := (ecKey.Curve.Params().BitSize + 7) / 8
		return append(fixedBytes(r, size), fixedBytes(s, size)...), nil
	}
}

func fixedBytes(value *big.Int, size int) []byte {
	out := make([]byte, size)
	return value.FillBytes(out)
}

func parsePrivateKey(text string) (crypto.Signer, error) {
	block, _ := pem.Decode([]byte(strings.TrimSpace(text)))
	if block == nil {
		return nil, fmt.Errorf("the private key is not PEM encoded")
	}
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if signer, ok := key.(crypto.Signer); ok {
			return signer, nil
		}
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	if key, err := x509.ParseECPrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, fmt.Errorf("the private key is not a valid RSA or EC key")
}
