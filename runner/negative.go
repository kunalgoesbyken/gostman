package runner

import (
	"context"
	"encoding/json"
	"time"
)

const (
	DefaultNegativeRate     = 5
	DefaultNegativeRequests = 300
)

type NegativeOptions struct {
	Folder      string
	Rate        float64
	MaxRequests int
	Only        []string
}

type NegativeFinding struct {
	Request  string `json:"request"`
	Method   string `json:"method"`
	URL      string `json:"url"`
	Variant  string `json:"variant"`
	Rule     string `json:"rule"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
	Status   int    `json:"status"`
}

type NegativeReport struct {
	Requests int               `json:"requests"`
	Sent     int               `json:"sent"`
	Unsent   int               `json:"unsent"`
	Capped   bool              `json:"capped"`
	Findings []NegativeFinding `json:"findings"`
}

type negativeVariant struct {
	ID      string          `json:"id"`
	Kind    string          `json:"kind"`
	Label   string          `json:"label"`
	Expect  string          `json:"expect"`
	Payload string          `json:"payload"`
	Request json.RawMessage `json:"request"`
}

type negativeVerdict struct {
	Rule     string `json:"rule"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
}

type negativeResponse struct {
	StatusCode int    `json:"statusCode"`
	Body       string `json:"body"`
}

func (s *Session) Negative(ctx context.Context, stored Collection, options NegativeOptions, observe func(NegativeFinding)) (NegativeReport, error) {
	listed, err := s.Catalog(stored, options.Folder)
	if err != nil {
		return NegativeReport{}, err
	}
	report := NegativeReport{Findings: []NegativeFinding{}}
	rate := options.Rate
	if rate <= 0 {
		rate = DefaultNegativeRate
	}
	limit := options.MaxRequests
	if limit <= 0 {
		limit = DefaultNegativeRequests
	}
	pause := time.Duration(float64(time.Second) / rate)
	for _, target := range listed {
		if !wantedNegative(target, options.Only) || isStreaming(target.Request) {
			continue
		}
		report.Requests++
		variants, err := s.negativeVariantsOf(stored, target.Request)
		if err != nil {
			return report, err
		}
		for _, variant := range variants {
			if ctx.Err() != nil {
				return report, ctx.Err()
			}
			if report.Sent >= limit {
				report.Capped = true
				return report, nil
			}
			var changed Request
			if err := json.Unmarshal(variant.Request, &changed); err != nil {
				continue
			}
			sent := s.Send(ctx, changed, target.Folder, nil)
			if sent.Response.Error != "" {
				report.Unsent++
				continue
			}
			report.Sent++
			verdicts, err := s.judgeNegative(variant, sent.Response.StatusCode, sent.Response.Body)
			if err != nil {
				return report, err
			}
			for _, verdict := range verdicts {
				found := NegativeFinding{
					Request: target.QualifiedName(), Method: target.Request.Method, URL: target.Request.URL, Variant: variant.Label,
					Rule: verdict.Rule, Severity: verdict.Severity, Message: verdict.Message, Status: sent.Response.StatusCode,
				}
				report.Findings = append(report.Findings, found)
				if observe != nil {
					observe(found)
				}
			}
			select {
			case <-ctx.Done():
			case <-time.After(pause):
			}
		}
	}
	return report, nil
}

func (s *Session) negativeVariantsOf(stored Collection, request Request) ([]negativeVariant, error) {
	var variants []negativeVariant
	err := s.state.scripts.Call("negativeVariants", &variants, request, inheritsAuth(stored, request))
	return variants, err
}

func (s *Session) judgeNegative(variant negativeVariant, status int, body string) ([]negativeVerdict, error) {
	var verdicts []negativeVerdict
	err := s.state.scripts.Call("negativeFindings", &verdicts, variant, negativeResponse{StatusCode: status, Body: body})
	return verdicts, err
}

func inheritsAuth(stored Collection, request Request) bool {
	byID := map[string]Folder{}
	for _, folder := range stored.Folders {
		byID[folder.ID] = folder
	}
	for id, steps := request.FolderID, 0; id != "" && steps < 64; steps++ {
		folder, found := byID[id]
		if !found {
			return false
		}
		if folder.Auth.Type != "" && folder.Auth.Type != "none" {
			return true
		}
		id = folder.ParentID
	}
	return false
}

func isStreaming(request Request) bool {
	switch request.Method {
	case "WS", "WEBSOCKET", "GRPC", "MCP", "SSE":
		return true
	}
	return false
}

func wantedNegative(target Listed, only []string) bool {
	if len(only) == 0 {
		return true
	}
	for _, name := range only {
		if name == target.Request.ID || name == target.Request.Name || name == target.QualifiedName() {
			return true
		}
	}
	return false
}
