package engine

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"

	pkcs12 "software.sslmate.com/src/go-pkcs12"
)

const (
	pemPrivateKey          = "PRIVATE KEY"
	pemEncryptedPrivateKey = "ENCRYPTED PRIVATE KEY"
	pemCertificate         = "CERTIFICATE"
	pemMarker              = "-----BEGIN "
)

var (
	ErrPassphraseNeeded = errors.New("the private key is protected by a passphrase; enter the passphrase")
	errPassphraseWrong  = errors.New("the passphrase does not open the private key")
	errNoPrivateKey     = errors.New("no private key was found; choose the key file, or a PFX/P12 file that holds the key")
)

func isPEM(data []byte) bool {
	return bytes.Contains(data, []byte(pemMarker))
}

func parseClientCertificate(cert, key []byte, passphrase string) (tls.Certificate, error) {
	if !isPEM(cert) {
		return pkcs12Certificate(cert, passphrase)
	}
	if len(bytes.TrimSpace(key)) == 0 {
		key = cert
	}
	keyPEM, err := plainKeyPEM(key, passphrase)
	if err != nil {
		return tls.Certificate{}, err
	}
	return tls.X509KeyPair(cert, keyPEM)
}

func pkcs12Certificate(data []byte, passphrase string) (tls.Certificate, error) {
	key, leaf, chain, err := pkcs12.DecodeChain(data, passphrase)
	if errors.Is(err, pkcs12.ErrIncorrectPassword) {
		if passphrase == "" {
			return tls.Certificate{}, ErrPassphraseNeeded
		}
		return tls.Certificate{}, errPassphraseWrong
	}
	if err != nil {
		return tls.Certificate{}, fmt.Errorf("the file is neither PEM nor a readable PFX/P12 file: %w", err)
	}
	certificate := tls.Certificate{Certificate: [][]byte{leaf.Raw}, PrivateKey: key, Leaf: leaf}
	for _, authority := range chain {
		certificate.Certificate = append(certificate.Certificate, authority.Raw)
	}
	return certificate, nil
}

func privateKeyBlock(data []byte) *pem.Block {
	for {
		block, rest := pem.Decode(data)
		if block == nil {
			return nil
		}
		if strings.HasSuffix(block.Type, pemPrivateKey) {
			return block
		}
		data = rest
	}
}

func plainKeyPEM(data []byte, passphrase string) ([]byte, error) {
	block := privateKeyBlock(data)
	if block == nil {
		return nil, errNoPrivateKey
	}
	switch {
	case block.Type == pemEncryptedPrivateKey:
		return decryptedPKCS8(block, passphrase)
	case x509.IsEncryptedPEMBlock(block):
		return decryptedLegacyKey(block, passphrase)
	}
	return pem.EncodeToMemory(block), nil
}

func requirePassphrase(passphrase string) error {
	if passphrase == "" {
		return ErrPassphraseNeeded
	}
	return nil
}

func decryptedPKCS8(block *pem.Block, passphrase string) ([]byte, error) {
	if err := requirePassphrase(passphrase); err != nil {
		return nil, err
	}
	der, err := decryptPKCS8(block.Bytes, []byte(passphrase))
	if err != nil {
		return nil, err
	}
	return pem.EncodeToMemory(&pem.Block{Type: pemPrivateKey, Bytes: der}), nil
}

func decryptedLegacyKey(block *pem.Block, passphrase string) ([]byte, error) {
	if err := requirePassphrase(passphrase); err != nil {
		return nil, err
	}
	der, err := x509.DecryptPEMBlock(block, []byte(passphrase))
	if err != nil {
		return nil, errPassphraseWrong
	}
	return pem.EncodeToMemory(&pem.Block{Type: block.Type, Bytes: der}), nil
}

func parseAuthorities(data []byte) ([]*x509.Certificate, error) {
	if !isPEM(data) {
		authorities, err := x509.ParseCertificates(data)
		if err != nil || len(authorities) == 0 {
			return nil, errors.New("the file holds no PEM or DER certificates")
		}
		return authorities, nil
	}
	var authorities []*x509.Certificate
	for block, rest := pem.Decode(data); block != nil; block, rest = pem.Decode(rest) {
		if block.Type != pemCertificate {
			continue
		}
		authority, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, err
		}
		authorities = append(authorities, authority)
	}
	if len(authorities) == 0 {
		return nil, errors.New("the file holds no PEM certificates")
	}
	return authorities, nil
}
