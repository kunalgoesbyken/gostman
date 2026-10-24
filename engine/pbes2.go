package engine

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/des"
	"crypto/pbkdf2"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"errors"
	"hash"
)

const maxKeyIterations = 1 << 22

var (
	oidPBES2  = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 5, 13}
	oidPBKDF2 = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 5, 12}

	keyHashes = map[string]func() hash.Hash{
		"1.2.840.113549.2.7":  sha1.New,
		"1.2.840.113549.2.8":  sha256.New224,
		"1.2.840.113549.2.9":  sha256.New,
		"1.2.840.113549.2.10": sha512.New384,
		"1.2.840.113549.2.11": sha512.New,
	}

	keyCiphers = map[string]keyCipher{
		"2.16.840.1.101.3.4.1.2":  {16, aes.NewCipher},
		"2.16.840.1.101.3.4.1.22": {24, aes.NewCipher},
		"2.16.840.1.101.3.4.1.42": {32, aes.NewCipher},
		"1.2.840.113549.3.7":      {24, des.NewTripleDESCipher},
	}

	errUnsupportedKeyEncryption = errors.New("the private key is encrypted with a scheme Gostman cannot read; convert it with openssl pkcs8 -topk8 -v2 aes-256-cbc")
)

type keyCipher struct {
	keyLength int
	block     func(key []byte) (cipher.Block, error)
}

type encryptedKeyInfo struct {
	Algorithm pkix.AlgorithmIdentifier
	Data      []byte
}

type pbes2Parameters struct {
	KeyDerivation pkix.AlgorithmIdentifier
	Encryption    pkix.AlgorithmIdentifier
}

type pbkdf2Parameters struct {
	Salt       []byte
	Iterations int
	KeyLength  int                      `asn1:"optional"`
	PRF        pkix.AlgorithmIdentifier `asn1:"optional"`
}

func decryptPKCS8(der, passphrase []byte) ([]byte, error) {
	var info encryptedKeyInfo
	if _, err := asn1.Unmarshal(der, &info); err != nil || !info.Algorithm.Algorithm.Equal(oidPBES2) {
		return nil, errUnsupportedKeyEncryption
	}
	var scheme pbes2Parameters
	if _, err := asn1.Unmarshal(info.Algorithm.Parameters.FullBytes, &scheme); err != nil || !scheme.KeyDerivation.Algorithm.Equal(oidPBKDF2) {
		return nil, errUnsupportedKeyEncryption
	}
	block, err := keyDecrypter(scheme, passphrase)
	if err != nil {
		return nil, err
	}
	plain, err := decryptCBC(block, scheme.Encryption.Parameters.FullBytes, info.Data)
	if err != nil {
		return nil, err
	}
	if _, err := x509.ParsePKCS8PrivateKey(plain); err != nil {
		return nil, errPassphraseWrong
	}
	return plain, nil
}

func keyDecrypter(scheme pbes2Parameters, passphrase []byte) (cipher.Block, error) {
	var derivation pbkdf2Parameters
	if _, err := asn1.Unmarshal(scheme.KeyDerivation.Parameters.FullBytes, &derivation); err != nil {
		return nil, errUnsupportedKeyEncryption
	}
	if derivation.Iterations < 1 || derivation.Iterations > maxKeyIterations {
		return nil, errUnsupportedKeyEncryption
	}
	digest := sha1.New
	if len(derivation.PRF.Algorithm) > 0 {
		digest = keyHashes[derivation.PRF.Algorithm.String()]
	}
	encryption, known := keyCiphers[scheme.Encryption.Algorithm.String()]
	if digest == nil || !known {
		return nil, errUnsupportedKeyEncryption
	}
	key, err := pbkdf2.Key(digest, string(passphrase), derivation.Salt, derivation.Iterations, encryption.keyLength)
	if err != nil {
		return nil, err
	}
	return encryption.block(key)
}

func decryptCBC(block cipher.Block, parameters, sealed []byte) ([]byte, error) {
	var iv []byte
	if _, err := asn1.Unmarshal(parameters, &iv); err != nil || len(iv) != block.BlockSize() {
		return nil, errUnsupportedKeyEncryption
	}
	if len(sealed) == 0 || len(sealed)%block.BlockSize() != 0 {
		return nil, errPassphraseWrong
	}
	plain := make([]byte, len(sealed))
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(plain, sealed)
	padding := int(plain[len(plain)-1])
	if padding == 0 || padding > block.BlockSize() || !bytes.Equal(plain[len(plain)-padding:], bytes.Repeat([]byte{byte(padding)}, padding)) {
		return nil, errPassphraseWrong
	}
	return plain[:len(plain)-padding], nil
}
