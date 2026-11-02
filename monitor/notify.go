package monitor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	EventFailed    = "run.failed"
	EventPassed    = "run.passed"
	EventRecovered = "run.recovered"

	NotifyOnFail   = "fail"
	NotifyOnAlways = "always"

	ShapeSlack    = "slack"
	ShapeTeams    = "teams"
	ShapeWorkflow = "workflow"
	ShapeDiscord  = "discord"
	ShapeJSON     = "json"

	notifyTimeout  = 10 * time.Second
	listedFailures = 8
)

type Failure struct {
	Request string   `json:"request"`
	Error   string   `json:"error,omitempty"`
	Checks  []string `json:"checks,omitempty"`
}

type Notice struct {
	Event       string    `json:"event"`
	Target      string    `json:"target"`
	Kind        string    `json:"kind"`
	Environment string    `json:"environment,omitempty"`
	StartedAt   string    `json:"startedAt"`
	DurationMs  int64     `json:"durationMs"`
	Passed      bool      `json:"passed"`
	Requests    int       `json:"requests"`
	FailedCount int       `json:"failedRequests"`
	FailedTests int       `json:"failedChecks"`
	Failures    []Failure `json:"failures,omitempty"`
}

func NoticeFor(record Record, event string) Notice {
	notice := Notice{
		Event:       event,
		Target:      record.Target,
		Kind:        record.Kind,
		Environment: record.Environment,
		StartedAt:   record.StartedAt.Format(time.RFC3339),
		DurationMs:  record.DurationMs,
		Passed:      record.Passed,
		Requests:    record.Summary.Requests,
		FailedCount: record.Summary.Failed,
		FailedTests: record.Summary.FailedTests,
	}
	for _, entry := range record.Requests {
		if !entry.Failed {
			continue
		}
		failure := Failure{Request: entry.Name, Error: entry.Error}
		for _, check := range entry.Failures {
			failure.Checks = append(failure.Checks, strings.TrimSpace(check.Name+": "+check.Message))
		}
		notice.Failures = append(notice.Failures, failure)
	}
	return notice
}

func Event(passed, previousFailed bool) string {
	switch {
	case !passed:
		return EventFailed
	case previousFailed:
		return EventRecovered
	}
	return EventPassed
}

func ShapeOf(address string) string {
	parsed, err := url.Parse(address)
	if err != nil {
		return ShapeJSON
	}
	host := strings.ToLower(parsed.Hostname())
	switch {
	case host == "hooks.slack.com" || host == "hooks.slack-gov.com":
		return ShapeSlack
	case strings.HasSuffix(host, ".webhook.office.com") || host == "outlook.office.com":
		return ShapeTeams
	case strings.HasSuffix(host, ".logic.azure.com") || strings.HasSuffix(host, ".powerplatform.com") || strings.HasSuffix(host, ".powerautomate.com"):
		return ShapeWorkflow
	case (host == "discord.com" || host == "discordapp.com") && strings.HasPrefix(parsed.Path, "/api/webhooks/"):
		return ShapeDiscord
	}
	return ShapeJSON
}

func (n Notice) Headline() string {
	subject := n.Target
	if subject == "" {
		subject = "run"
	}
	switch n.Event {
	case EventFailed:
		return fmt.Sprintf("Gostman: %s failed (%d of %d requests failed, %d checks failed)", subject, n.FailedCount, n.Requests, n.FailedTests)
	case EventRecovered:
		return fmt.Sprintf("Gostman: %s passes again", subject)
	}
	return fmt.Sprintf("Gostman: %s passed (%d requests)", subject, n.Requests)
}

func (n Notice) Text() string {
	lines := []string{n.Headline()}
	for index, failure := range n.Failures {
		if index == listedFailures {
			lines = append(lines, fmt.Sprintf("and %d more", len(n.Failures)-listedFailures))
			break
		}
		detail := failure.Error
		if len(failure.Checks) > 0 {
			detail = strings.Join(failure.Checks, "; ")
		}
		lines = append(lines, "- "+strings.TrimSpace(failure.Request+": "+detail))
	}
	return strings.Join(lines, "\n")
}

func (n Notice) Payload(shape string) any {
	switch shape {
	case ShapeSlack:
		return map[string]any{"text": n.Text()}
	case ShapeDiscord:
		return map[string]any{"content": n.Text()}
	case ShapeTeams:
		return map[string]any{
			"@type":    "MessageCard",
			"@context": "http://schema.org/extensions",
			"summary":  n.Headline(),
			"title":    n.Headline(),
			"text":     strings.ReplaceAll(strings.TrimPrefix(n.Text(), n.Headline()), "\n", "\n\n"),
		}
	case ShapeWorkflow:
		return map[string]any{
			"type": "message",
			"attachments": []any{map[string]any{
				"contentType": "application/vnd.microsoft.card.adaptive",
				"content": map[string]any{
					"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
					"type":    "AdaptiveCard",
					"version": "1.4",
					"body":    []any{map[string]any{"type": "TextBlock", "text": n.Text(), "wrap": true}},
				},
			}},
		}
	}
	return n
}

type Notifier struct {
	Address   string
	Transport http.RoundTripper
}

func (n Notifier) Validate() error {
	parsed, err := url.Parse(n.Address)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return errors.New("the notification address must be an http or https URL")
	}
	return nil
}

func (n Notifier) Post(ctx context.Context, notice Notice) error {
	body, err := json.Marshal(notice.Payload(ShapeOf(n.Address)))
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, notifyTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, n.Address, bytes.NewReader(body))
	if err != nil {
		return errors.New("the notification address is not valid")
	}
	request.Header.Set("Content-Type", "application/json")
	client := &http.Client{
		Transport: n.Transport,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	response, err := client.Do(request)
	if err != nil {
		var failure *url.Error
		if errors.As(err, &failure) {
			err = failure.Err
		}
		return fmt.Errorf("the notification was not delivered: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("the notification was refused with status %d", response.StatusCode)
	}
	return nil
}
