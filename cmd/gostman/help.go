package main

import (
	"slices"
	"strings"
)

const (
	usageHeading     = "Usage:"
	exitCodesHeading = "Exit codes:"
	everyCommandHint = `Run "gostman help <command>" for one command ("gostman help run" for the
flags that say "as for run"), or "gostman help" for every command.`
)

func isHeading(line string) bool {
	return line != "" && !strings.HasPrefix(line, " ")
}

func section(lines []string, heading string) []string {
	start := slices.Index(lines, heading)
	if start < 0 {
		return nil
	}
	end := start + 1
	for end < len(lines) && !isHeading(lines[end]) {
		end++
	}
	return slices.Clone(lines[start:end])
}

func usageLinesOf(lines []string, command string) []string {
	prefix := "  " + programName + " " + command
	kept := []string{usageHeading}
	for _, line := range section(lines, usageHeading) {
		if line == prefix || strings.HasPrefix(line, prefix+" ") {
			kept = append(kept, line)
		}
	}
	return kept
}

func helpFor(command string) string {
	if !isHeading(command) {
		return usage
	}
	lines := strings.Split(usage, "\n")
	described := section(lines, command)
	if described == nil {
		return usage
	}
	parts := []string{
		strings.Join(usageLinesOf(lines, command), "\n"),
		strings.TrimRight(strings.Join(described, "\n"), "\n"),
		strings.TrimRight(strings.Join(section(lines, exitCodesHeading), "\n"), "\n"),
		everyCommandHint,
	}
	return strings.Join(parts, "\n\n") + "\n"
}
