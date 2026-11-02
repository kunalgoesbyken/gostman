package openapi

import "context"

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
