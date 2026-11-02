package openapi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
)

func digest(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func Fingerprint(ctx context.Context, source Source, opt Options) (string, error) {
	data, _, err := opt.withAllowance().read(ctx, source)
	if err != nil {
		return "", err
	}
	return digest(data), nil
}

func ReadText(ctx context.Context, source Source, opt Options) (string, error) {
	data, _, err := opt.withAllowance().read(ctx, source)
	return string(data), err
}

func ReadRoot(ctx context.Context, source Source, opt Options) (map[string]any, error) {
	data, _, err := opt.withAllowance().read(ctx, source)
	if err != nil {
		return nil, err
	}
	return decode(data)
}
