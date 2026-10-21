package deeplink

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/importer"
)

const (
	MaxBytes = 10 << 20

	fetchTimeout = 25 * time.Second
	maxRedirects = 5
	defaultName  = "link"
)

type Reply struct {
	File  importer.File `json:"file"`
	Host  string        `json:"host,omitempty"`
	Error string        `json:"error,omitempty"`
}

var strictPolicy = engine.Policy{BlockPrivate: true}

func Fetch(ctx context.Context, raw string, limit int64) Reply {
	source, err := ParseSource(raw)
	if err != nil {
		return Reply{Error: err.Error()}
	}
	data, final, err := download(ctx, source, limit)
	if err != nil {
		return Reply{Error: explain(err, firstNonEmpty(final.Host, source.Host), limit)}
	}
	text, err := importer.DecodeText(data)
	if err != nil {
		return Reply{Error: fmt.Sprintf("%s did not send a text file that Gostman can read", final.Host)}
	}
	return Reply{File: importer.File{Name: fileName(final.URL), Text: text}, Host: final.Host}
}

func firstNonEmpty(first, second string) string {
	if first != "" {
		return first
	}
	return second
}

func client() *http.Client {
	return &http.Client{
		Timeout:   fetchTimeout,
		Transport: strictPolicy.Transport(false),
		CheckRedirect: func(next *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return fmt.Errorf("stopped after %d redirects", maxRedirects)
			}
			_, err := ParseSource(next.URL.String())
			return err
		},
	}
}

type statusError int

func (s statusError) Error() string { return fmt.Sprintf("answered %d", int(s)) }

type sizeError struct{ limit int64 }

func (s sizeError) Error() string { return fmt.Sprintf("larger than %d MB", s.limit>>20) }

func download(ctx context.Context, source Source, limit int64) ([]byte, Source, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, source.URL, nil)
	if err != nil {
		return nil, Source{}, err
	}
	request.Header.Set("Accept", "application/json, application/yaml, text/yaml, text/plain, */*;q=0.5")
	response, err := client().Do(request)
	if err != nil {
		return nil, Source{}, err
	}
	defer response.Body.Close()
	final := Source{URL: response.Request.URL.String(), Host: response.Request.URL.Host}
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return nil, final, statusError(response.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil {
		return nil, final, err
	}
	if int64(len(data)) > limit {
		return nil, final, sizeError{limit}
	}
	return data, final, nil
}

func explain(err error, host string, limit int64) string {
	var status statusError
	var size sizeError
	var network net.Error
	switch {
	case errors.As(err, &size):
		return fmt.Sprintf("The file is larger than %d MB, so Gostman did not download it", limit>>20)
	case errors.As(err, &status):
		return fmt.Sprintf("%s answered with HTTP %d instead of a file", host, int(status))
	case engine.IsBlockedAddress(err):
		return fmt.Sprintf("%s points to a private or internal address, which this app cannot reach", host)
	case errors.Is(err, context.DeadlineExceeded) || errors.As(err, &network) && network.Timeout():
		return fmt.Sprintf("%s did not answer in time", host)
	}
	return fmt.Sprintf("Gostman could not reach %s", host)
}

func fileName(address string) string {
	parsed, err := url.Parse(address)
	if err != nil {
		return defaultName
	}
	base := path.Base(parsed.Path)
	stem := strings.TrimSuffix(base, path.Ext(base))
	if stem == "" || stem == "." || stem == "/" {
		return defaultName
	}
	return stem
}
