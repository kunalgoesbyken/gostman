package runner

import (
	"time"

	"github.com/kunalgoesbyken/gostman/openapi"
)

const (
	ContractKind      = "contract"
	contractNoteLevel = "warn"
)

type contract struct {
	spec  *openapi.Contract
	index openapi.Contract
}

type operationMatch struct {
	Key  string `json:"key"`
	Note string `json:"note"`
}

func newContract(spec *openapi.Contract) *contract {
	if spec == nil {
		return nil
	}
	return &contract{spec: spec, index: spec.Index()}
}

func (s *session) checkContract(request Request, outcome *exchange) error {
	if s.contract == nil || outcome.response.Protocol != "" {
		return nil
	}
	var match operationMatch
	if err := s.scripts.Call("operationKey", &match, s.contract.index, request.Method, outcome.response.URL); err != nil {
		return err
	}
	if match.Note != "" {
		outcome.logs = append(outcome.logs, LogLine{Level: contractNoteLevel, Text: match.Note, At: time.Now().UnixMilli()})
	}
	operation, root, found := s.contract.spec.Operation(match.Key)
	if !found {
		return nil
	}
	var checks []Check
	if err := s.scripts.Call("contractChecks", &checks, operation, root, outcome.response); err != nil {
		return err
	}
	outcome.tests = append(outcome.tests, checks...)
	return nil
}
