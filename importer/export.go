package importer

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"unicode"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	ExportBruno   = "bruno"
	ExportOpenAPI = "openapi"
	ExportCurl    = "curl"
	ExportHAR     = "har"
	ExportHTTP    = "http"

	exportName     = "Gostman"
	maxStemRunes   = 100
	fallbackStem   = "request"
	folderFallback = "folder"
)

var reservedStems = map[string]bool{"con": true, "prn": true, "aux": true, "nul": true}

type exportTree struct {
	folders  map[string][]workspace.Folder
	requests map[string][]workspace.Request
	siblings map[string][]workspace.Sibling
	tests    map[string]string
}

func Export(format string, collection workspace.Collection, options Options) ([]File, string, Report, error) {
	if format != ExportCurl && !options.IncludeSecrets {
		collection, _ = RedactSecrets(collection)
	}
	var files []File
	var report Report
	var err error
	switch format {
	case ExportBruno:
		_, draft := adaptCollection(brunoTarget, collection)
		adapted, scripts := adaptCollection(brunoTarget.withRequests(brunoRequestPaths(collection, draft.tests)), collection)
		files, report = exportBruno(adapted, scripts.tests), scripts.report()
		report.Warnings = append(report.Warnings, brunoOrderWarnings(adapted)...)
	case ExportOpenAPI:
		files, err = exportOpenAPI(collection)
	case ExportCurl:
		files = exportCurl(collection, options)
	case ExportHAR:
		files, err = exportHAR(collection)
	case ExportHTTP:
		files = exportHTTP(collection, options)
	default:
		return nil, "", report, fmt.Errorf("unknown export format %q; choose postman, bruno, openapi, curl, har or http", format)
	}
	if err != nil {
		return nil, "", report, err
	}
	if len(files) <= 1 {
		return files, "", report, nil
	}
	archive, err := zipFiles(files)
	return files, archive, report, err
}

func zipFiles(files []File) (string, error) {
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for _, file := range files {
		entry, err := writer.Create(file.Name)
		if err != nil {
			return "", err
		}
		if _, err := entry.Write([]byte(file.Text)); err != nil {
			return "", err
		}
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(buffer.Bytes()), nil
}

func buildTree(collection workspace.Collection) exportTree {
	tree := exportTree{folders: map[string][]workspace.Folder{}, requests: map[string][]workspace.Request{}}
	tree.siblings = workspace.SiblingGroups(collection.Folders, collection.Requests, collection.SharedOrder)
	for parent, siblings := range tree.siblings {
		for _, sibling := range siblings {
			if sibling.Folder != nil {
				tree.folders[parent] = append(tree.folders[parent], *sibling.Folder)
				continue
			}
			tree.requests[parent] = append(tree.requests[parent], *sibling.Request)
		}
	}
	return tree
}

func readRows(source string) []row {
	var decoded any
	if strings.TrimSpace(source) == "" || json.Unmarshal([]byte(source), &decoded) != nil {
		return nil
	}
	if entries := objects(decoded); entries != nil {
		rows := make([]row, 0, len(entries))
		for _, entry := range entries {
			rows = append(rows, row{
				Key: text(entry["key"]), Value: text(entry["value"]), Enabled: entry["enabled"] != false,
				Type: text(entry["type"]), FileName: text(entry["fileName"]), ContentType: text(entry["contentType"]),
			})
		}
		return keyedRows(rows)
	}
	return objectRows(object(decoded))
}

func objectRows(values map[string]any) []row {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	rows := make([]row, 0, len(keys))
	for _, key := range keys {
		rows = append(rows, row{Key: key, Value: text(values[key]), Enabled: true})
	}
	return keyedRows(rows)
}

func enabledRows(rows []row) []row {
	var kept []row
	for _, candidate := range rows {
		if candidate.Enabled {
			kept = append(kept, candidate)
		}
	}
	return kept
}

func safeStem(name, fallback string) string {
	var out strings.Builder
	for _, r := range name {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.IsMark(r) || r == '_' || r == '-' || r == ' ' || r == '(' || r == ')':
			out.WriteRune(r)
		default:
			out.WriteRune('-')
		}
	}
	stem := strings.Trim(strings.TrimSpace(clip(out.String(), maxStemRunes)), "-. ")
	if stem == "" {
		return fallback
	}
	if reservedStems[strings.ToLower(stem)] {
		return "_" + stem
	}
	return stem
}

func uniqueName(used map[string]bool, stem, extension string) string {
	for attempt := 1; ; attempt++ {
		candidate := stem + extension
		if attempt > 1 {
			candidate = fmt.Sprintf("%s (%d)%s", stem, attempt, extension)
		}
		key := strings.ToLower(candidate)
		if !used[key] {
			used[key] = true
			return candidate
		}
	}
}
