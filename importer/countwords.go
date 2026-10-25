package importer

import (
	"fmt"
	"strings"
)

type countedNoun struct {
	count int
	noun  string
}

const (
	nounCollection   = "collection"
	nounFolder       = "folder"
	nounRequest      = "request"
	countsHolding    = "%s with %s"
	countsSettingsOf = "settings for %s"
	countsSeparator  = "; "
)

func (c Counts) Describe() string {
	values := countedList([]countedNoun{{c.Environments, "environment"}, {c.Globals, "global environment"}, {c.Variables, "collection variable"}})
	settings := countedList([]countedNoun{{c.CollectionSettings, nounCollection}, {c.FolderSettings, nounFolder}})
	parts := []string{c.structure()}
	if values != "" {
		parts = append(parts, values)
	}
	if settings != "" {
		parts = append(parts, fmt.Sprintf(countsSettingsOf, settings))
	}
	return strings.Join(parts, countsSeparator)
}

func (c Counts) structure() string {
	inside := countedList([]countedNoun{{c.Folders, nounFolder}, {c.Requests, nounRequest}})
	switch {
	case c.Collections == 0 && inside == "":
		return pluralNoun(0, nounRequest)
	case c.Collections == 0:
		return inside
	case inside == "":
		return pluralNoun(c.Collections, nounCollection)
	}
	return fmt.Sprintf(countsHolding, pluralNoun(c.Collections, nounCollection), inside)
}

func countedList(items []countedNoun) string {
	var parts []string
	for _, item := range items {
		if item.count > 0 {
			parts = append(parts, pluralNoun(item.count, item.noun))
		}
	}
	if len(parts) < 2 {
		return strings.Join(parts, "")
	}
	return strings.Join(parts[:len(parts)-1], ", ") + " and " + parts[len(parts)-1]
}

func pluralNoun(count int, noun string) string {
	if count == 1 {
		return "1 " + noun
	}
	return fmt.Sprintf("%d %ss", count, noun)
}
