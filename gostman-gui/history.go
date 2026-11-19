package main

import (
	"encoding/json"
	"path/filepath"
)

const historyFileName = "history.json"

var historySection = section{
	key:     "history",
	path:    filepath.Join(appFolder, historyFileName),
	carried: func(carried carriedSections) json.RawMessage { return carried.History },
}

func (a *App) SaveHistory(history []HistoryEntry) error {
	return saveSection(historySection, history)
}
