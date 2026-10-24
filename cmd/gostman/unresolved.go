package main

import (
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

func variableFlag(name string) string {
	if strings.ContainsAny(name, " \t\"'") {
		return "--var " + strconv.Quote(name+"=...")
	}
	return "--var " + name + "=..."
}

func unresolvedAdvice(names []string) string {
	flags := make([]string, len(names))
	for i, name := range names {
		flags[i] = variableFlag(name)
	}
	pronoun := "it"
	if len(names) > 1 {
		pronoun = "them"
	}
	return fmt.Sprintf("%s. Define %s in an environment, or pass %s", engine.NotDefined(names), pronoun, strings.Join(flags, " "))
}

func warnUnresolved(stderr io.Writer, label string, names []string) {
	if len(names) == 0 {
		return
	}
	if label != "" {
		label += ": "
	}
	fmt.Fprintf(stderr, "warning: %s%s\n", label, unresolvedAdvice(names))
}
