package openapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"gopkg.in/yaml.v3"
)

const (
	DefaultMaxBytes = 10 << 20
	defaultMaxRefs  = 50
	fetchTimeout    = 25 * time.Second
	totalFetchTime  = 60 * time.Second
	maxRedirects    = 5

	maxRefHops       = 32
	maxWarningsShown = 20
)

type Source struct {
	Text string `json:"text"`
	URL  string `json:"url"`
	Path string `json:"path"`
}

type Options struct {
	Policy     engine.Policy
	AllowFiles bool
	MaxBytes   int64
	MaxRefs    int
	spent      *allowance
}

type allowance struct {
	left     int64
	deadline time.Time
}

func (o Options) limit() int64 {
	if o.MaxBytes > 0 {
		return o.MaxBytes
	}
	return DefaultMaxBytes
}

func (o Options) allowed() int64 {
	if o.spent == nil {
		return o.limit()
	}
	return min(o.limit(), o.spent.left)
}

func (o Options) charge(data []byte) {
	if o.spent != nil {
		o.spent.left -= int64(len(data))
	}
}

func (o Options) withAllowance() Options {
	duration := totalFetchTime
	if o.Policy.MaxTimeout > 0 {
		duration = o.Policy.MaxTimeout
	}
	o.spent = &allowance{left: o.limit(), deadline: time.Now().Add(duration)}
	return o
}

func (o Options) refLimit() int {
	if o.MaxRefs > 0 {
		return o.MaxRefs
	}
	return defaultMaxRefs
}

func (o Options) client() *http.Client {
	return &http.Client{
		Timeout:   fetchTimeout,
		Transport: o.Policy.Transport(false),
		CheckRedirect: func(next *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return fmt.Errorf("stopped after %d redirects", maxRedirects)
			}
			return checkScheme(next.URL)
		},
	}
}

func checkScheme(u *url.URL) error {
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("only http and https addresses can be fetched, not %q", u.Scheme)
	}
	if u.Host == "" {
		return errors.New("the address has no host")
	}
	return nil
}

func (o Options) fetch(ctx context.Context, address string) ([]byte, error) {
	parsed, err := url.Parse(address)
	if err != nil {
		return nil, err
	}
	if err := checkScheme(parsed); err != nil {
		return nil, err
	}
	if o.spent != nil {
		var cancel context.CancelFunc
		ctx, cancel = context.WithDeadline(ctx, o.spent.deadline)
		defer cancel()
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json, application/yaml, text/yaml, */*;q=0.5")
	response, err := o.client().Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return nil, fmt.Errorf("%s answered %s", parsed.Host, response.Status)
	}
	data, err := readLimited(response.Body, o.allowed())
	if err != nil {
		return nil, err
	}
	o.charge(data)
	return data, nil
}

func Fetch(ctx context.Context, address string, opt Options) ([]byte, error) {
	return opt.withAllowance().fetch(ctx, address)
}

func readLimited(reader io.Reader, limit int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("the document is larger than %d MB", limit>>20)
	}
	return data, nil
}

func (o Options) readFile(path string) ([]byte, error) {
	if !o.AllowFiles {
		return nil, errors.New("local files cannot be read here")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := readLimited(file, o.allowed())
	if err != nil {
		return nil, err
	}
	o.charge(data)
	return data, nil
}

func (o Options) read(ctx context.Context, source Source) ([]byte, string, error) {
	switch {
	case source.Text != "":
		if int64(len(source.Text)) > o.allowed() {
			return nil, "", fmt.Errorf("the document is larger than %d MB", o.allowed()>>20)
		}
		data := []byte(source.Text)
		o.charge(data)
		return data, "", nil
	case source.URL != "":
		data, err := o.fetch(ctx, source.URL)
		return data, source.URL, err
	case source.Path != "":
		data, err := o.readFile(source.Path)
		return data, source.Path, err
	}
	return nil, "", errors.New("give a spec as text, an address or a file")
}

func decode(data []byte) (map[string]any, error) {
	data = bytes.TrimPrefix(data, []byte("\xef\xbb\xbf"))
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil, errors.New("the document is empty")
	}
	var value any
	var jsonErr error
	if trimmed[0] == '{' {
		if jsonErr = json.Unmarshal(trimmed, &value); jsonErr == nil {
			return asRoot(value)
		}
	}
	value = nil
	if err := yaml.Unmarshal(data, &value); err != nil {
		if jsonErr != nil {
			return nil, fmt.Errorf("could not read the document as JSON (%v) or YAML (%v)", jsonErr, err)
		}
		return nil, fmt.Errorf("could not read the document as JSON or YAML: %v", err)
	}
	return asRoot(normalize(value))
}

func asRoot(value any) (map[string]any, error) {
	root, ok := value.(map[string]any)
	if !ok {
		return nil, errors.New("the document is not an object")
	}
	return root, nil
}

func normalize(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		for key, item := range typed {
			typed[key] = normalize(item)
		}
		return typed
	case map[any]any:
		converted := make(map[string]any, len(typed))
		for key, item := range typed {
			converted[fmt.Sprint(key)] = normalize(item)
		}
		return converted
	case []any:
		for index, item := range typed {
			typed[index] = normalize(item)
		}
		return typed
	case time.Time:
		if typed.Hour() == 0 && typed.Minute() == 0 && typed.Second() == 0 && typed.Location() == time.UTC {
			return typed.Format("2006-01-02")
		}
		return typed.Format(time.RFC3339)
	}
	return value
}
