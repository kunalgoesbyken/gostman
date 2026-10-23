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
}

func Export(format string, collection workspace.Collection, options Options) ([]File, string, error) {
	if format != ExportCurl && !options.IncludeSecrets {
		collection = redactSecrets(collection)
	}
	var files []File
	var err error
	switch format {
	case ExportBruno:
		files = exportBruno(collection)
	case ExportOpenAPI:
		files, err = exportOpenAPI(collection)
	case ExportCurl:
		files = exportCurl(collection, options)
	case ExportHAR:
		files, err = exportHAR(collection)
	case ExportHTTP:
		files = exportHTTP(collection, options)
	default:
		return nil, "", fmt.Errorf("unknown export format %q", format)
	}
	if err != nil {
		return nil, "", err
	}
	if len(files) <= 1 {
		return files, "", nil
	}
	archive, err := zipFiles(files)
	return files, archive, err
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
	known := map[string]bool{}
	for _, folder := range collection.Folders {
		known[folder.Id] = true
	}
	tree := exportTree{folders: map[string][]workspace.Folder{}, requests: map[string][]workspace.Request{}}
	for _, folder := range collection.Folders {
		parent := folder.ParentId
		if !known[parent] || parent == folder.Id {
			parent = ""
		}
		tree.folders[parent] = append(tree.folders[parent], folder)
	}
	for _, request := range collection.Requests {
		parent := request.FolderId
		if !known[parent] {
			parent = ""
		}
		tree.requests[parent] = append(tree.requests[parent], request)
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
