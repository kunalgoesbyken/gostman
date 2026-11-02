package runner

import (
	"fmt"
)

type CoverageTotals struct {
	Total   int     `json:"total"`
	Covered int     `json:"covered"`
	Percent float64 `json:"percent"`
}

type CoverageResponse struct {
	Code    string `json:"code"`
	Covered bool   `json:"covered"`
}

type CoverageOperation struct {
	Key          string             `json:"key"`
	Method       string             `json:"method"`
	Path         string             `json:"path"`
	Covered      bool               `json:"covered"`
	Responses    []CoverageResponse `json:"responses"`
	Undocumented []int              `json:"undocumented"`
}

type Coverage struct {
	Operations CoverageTotals      `json:"operations"`
	Responses  CoverageTotals      `json:"responses"`
	Items      []CoverageOperation `json:"items"`
}

type coverageHit struct {
	Key    string `json:"key"`
	Status int    `json:"status"`
}

func coverageHits(results []Result) []coverageHit {
	hits := []coverageHit{}
	for _, result := range results {
		if result.Operation == "" || result.IsSkipped() || result.StatusCode == 0 || result.Error != "" {
			continue
		}
		hits = append(hits, coverageHit{Key: result.Operation, Status: result.StatusCode})
	}
	return hits
}

func (s *session) coverageOf(results []Result) (*Coverage, error) {
	if s.contract == nil {
		return nil, nil
	}
	var coverage Coverage
	if err := s.scripts.Call("contractCoverage", &coverage, s.contract.spec.Outline(), coverageHits(results)); err != nil {
		return nil, err
	}
	return &coverage, nil
}

func (c Coverage) Meets(minimum float64) bool {
	return float64(c.Operations.Covered)*100 >= minimum*float64(c.Operations.Total)
}

func (c Coverage) Shortfall(minimum float64) string {
	return fmt.Sprintf("operation coverage is %.1f%% (%d of %d operations), below the required %.1f%%", c.Operations.Percent, c.Operations.Covered, c.Operations.Total, minimum)
}
