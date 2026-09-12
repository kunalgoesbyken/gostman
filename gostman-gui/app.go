package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Data Structures

type SavedData struct {
	Variables string    `json:"variables"`
	Requests  []Request `json:"requests"`
	Folders   []Folder  `json:"folders"`
	History   []Request `json:"history"`
}

type Folder struct {
	Id     string `json:"id"`
	Name   string `json:"name"`
	IsOpen bool   `json:"isOpen"`
}

type Request struct {
	Id               string `json:"id"`
	Name             string `json:"name"`
	URL              string `json:"url"`
	Method           string `json:"method"`
	Headers          string `json:"headers"`
	Body             string `json:"body"`
	QueryParams      string `json:"queryParams"`
	Response         string `json:"response"`
	FolderId         string `json:"folderId"`
	GraphqlQuery     string `json:"graphqlQuery"`
	GraphqlVariables string `json:"graphqlVariables"`
	Timestamp        string `json:"timestamp"`
}

type ResponseMsg struct {
	Body     string        `json:"body"`
	Status   string        `json:"status"`
	Headers  []HeaderEntry `json:"headers"`
	Cookies  []CookieInfo  `json:"cookies"`
	Size     int64         `json:"size"`
}

type HeaderEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CookieInfo struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Domain   string `json:"domain"`
	Path     string `json:"path"`
	Expires  string `json:"expires"`
	Secure   bool   `json:"secure"`
	HttpOnly bool   `json:"httpOnly"`
}

// Globals
var appFolder = getAppDataPath()
var jsonfilePath = filepath.Join(appFolder, "gostman.json")
var dataMutex sync.RWMutex

// --- Helper Functions (Private) ---

func getAppDataPath() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(os.Getenv("APPDATA"), "Gostman")
	}
	// Linux and macOS path: ~/.local/share/Gostman
	return filepath.Join(os.Getenv("HOME"), ".local", "share", "Gostman")
}

// getSavedData loads the entire data structure from disk.
// It returns an empty SavedData if the file doesn't exist or errors.
func getSavedData() SavedData {
	dataMutex.RLock()
	defer dataMutex.RUnlock()

	file, err := os.ReadFile(jsonfilePath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return SavedData{}
		}
		log.Printf("Error reading data file: %v", err)
		return SavedData{}
	}
	var data SavedData
	if len(file) > 0 {
		err = json.Unmarshal(file, &data)
		if err != nil {
			log.Println("Error unmarshaling file data:", err)
		}
	}
	return data
}

// saveSavedData persists the data structure to disk.
func saveSavedData(data SavedData) error {
	dataMutex.Lock()
	defer dataMutex.Unlock()

	if err := os.MkdirAll(appFolder, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	updatedData, err := json.MarshalIndent(data, "", " ")
	if err != nil {
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	if err := os.WriteFile(jsonfilePath, updatedData, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}
	return nil
}

// mutateSavedData acquires a write lock, reads the file, calls fn to mutate
// the data in-place, then writes the file back. It is safe against concurrent
// goroutines because the lock is held for the entire read-modify-write cycle.
func (a *App) mutateSavedData(fn func(data *SavedData)) error {
	dataMutex.Lock()
	defer dataMutex.Unlock()

	var data SavedData
	file, err := os.ReadFile(jsonfilePath)
	if err != nil {
		if !errors.Is(err, fs.ErrNotExist) {
			return fmt.Errorf("failed to read data file: %w", err)
		}
	} else if len(file) > 0 {
		if err := json.Unmarshal(file, &data); err != nil {
			return fmt.Errorf("failed to unmarshal data: %w", err)
		}
	}

	fn(&data)

	if err := os.MkdirAll(appFolder, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	updatedData, err := json.MarshalIndent(data, "", " ")
	if err != nil {
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	if err := os.WriteFile(jsonfilePath, updatedData, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}
	return nil
}

var placeholderRe = regexp.MustCompile(`{{([^}]+)}}`)

// coerceVariables converts a map of arbitrary JSON values into a map of
// strings, matching the JS-side parseVariables behavior. nil values are
// skipped (treated as missing) so their placeholders stay unchanged.
func coerceVariables(raw map[string]any) map[string]string {
	out := make(map[string]string, len(raw))
	for k, v := range raw {
		if v == nil {
			continue
		}
		out[k] = fmt.Sprintf("%v", v)
	}
	return out
}

func replacePlaceholders(input string, variables map[string]string) string {
	return placeholderRe.ReplaceAllStringFunc(input, func(match string) string {
		sub := placeholderRe.FindStringSubmatch(match)
		if len(sub) < 2 {
			return match
		}
		key := strings.TrimSpace(sub[1])
		if value, exists := variables[key]; exists {
			return value
		}
		return match
	})
}

// --- Exported Methods (Callable from JS) ---

// SendRequest executes an HTTP (or GraphQL) request.
//
// graphqlQuery/graphqlVariables come from the dedicated GraphQL tab fields and
// take precedence when non-empty; otherwise we fall back to bodyStr/paramsJSON
// so previously saved requests and Postman imports keep working.
//
// variablesJSON carries the {{placeholder}} values straight from the Env Vars
// editor, so unsaved edits apply to the very next Send. It is deliberately NOT
// backfilled from the on-disk copy (GetVariables): reading disk when the
// frontend sends "" or "{}" would silently resurrect stale values and recreate
// the desktop/web mismatch this parameter exists to remove. An empty string
// means "no variables", exactly as it does on the web target.
func (a *App) SendRequest(method, urlStr, headersJSON, bodyStr, paramsJSON, graphqlQuery, graphqlVariables, variablesJSON string) ResponseMsg {
	// Handle GraphQL requests - convert to POST with JSON body
	if method == "GRAPHQL" {
		method = "POST"
		// Format GraphQL request
		var graphqlReq struct {
			Query     string `json:"query"`
			Variables any    `json:"variables"`
		}

		// Dedicated GraphQL fields win when present, else fall back.
		queryStr := bodyStr
		if strings.TrimSpace(graphqlQuery) != "" {
			queryStr = graphqlQuery
		}
		varsStr := paramsJSON
		if strings.TrimSpace(graphqlVariables) != "" {
			varsStr = graphqlVariables
		}
		graphqlReq.Query = queryStr

		// Parse variables if provided
		var vars map[string]any
		if err := json.Unmarshal([]byte(varsStr), &vars); err == nil {
			graphqlReq.Variables = vars
		}

		formattedBody, err := json.Marshal(graphqlReq)
		if err == nil {
			bodyStr = string(formattedBody)
		}

		// Ensure Content-Type header is set (case-insensitive check)
		var headers map[string]string
		if err := json.Unmarshal([]byte(headersJSON), &headers); err == nil {
			hasContentType := false
			for k := range headers {
				if strings.EqualFold(k, "Content-Type") {
					hasContentType = true
					break
				}
			}
			if !hasContentType {
				headers["Content-Type"] = "application/json"
			}
			updatedHeaders, err := json.Marshal(headers)
			if err != nil {
				return ResponseMsg{Body: fmt.Sprintf("Error encoding GraphQL headers: %v", err), Status: "Configuration Error", Headers: nil, Cookies: nil, Size: 0}
			}
			headersJSON = string(updatedHeaders)
		} else {
			return ResponseMsg{Body: fmt.Sprintf("Error parsing GraphQL Headers JSON: %v", err), Status: "Configuration Error", Headers: nil, Cookies: nil, Size: 0}
		}
	}

	// 1. Parse the caller-supplied variables (coerce non-string values to string)
	var rawVars map[string]any
	if strings.TrimSpace(variablesJSON) != "" {
		if err := json.Unmarshal([]byte(variablesJSON), &rawVars); err != nil {
			return ResponseMsg{Body: "Error parsing Env Variables", Status: "Configuration Error", Headers: nil, Cookies: nil, Size: 0}
		}
	}
	variables := coerceVariables(rawVars)

	// 2. Variable Substitution
	urlStr = replacePlaceholders(urlStr, variables)
	headersJSON = replacePlaceholders(headersJSON, variables)
	paramsJSON = replacePlaceholders(paramsJSON, variables)
	bodyStr = replacePlaceholders(bodyStr, variables)

	// 3. Parse Headers
	var headers map[string]string
	if err := json.Unmarshal([]byte(headersJSON), &headers); err != nil {
		return ResponseMsg{Body: "Error parsing Headers. Check JSON format.", Status: "Configuration Error", Headers: nil, Cookies: nil, Size: 0}
	}

	// 4. Parse Query Params & Build URL
	if paramsJSON != "" {
		var params map[string]string
		if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
			return ResponseMsg{Body: "Error parsing Query Params. Check JSON format.", Status: "Configuration Error", Headers: nil, Cookies: nil, Size: 0}
		}
		parsedURL, err := url.Parse(urlStr)
		if err != nil {
			return ResponseMsg{Body: "Invalid URL format.", Status: "Configuration Error", Headers: nil, Cookies: nil, Size: 0}
		}
		q := parsedURL.Query()
		for key, value := range params {
			q.Set(key, value)
		}
		parsedURL.RawQuery = q.Encode()
		urlStr = parsedURL.String()
	}

	// 4b. Default scheme to https if missing
	if !strings.Contains(urlStr, "://") {
		urlStr = "https://" + urlStr
	}

	// 5. Build Request
	method = strings.ToUpper(strings.TrimSpace(method))
	var req *http.Request
	var err error

	if len(bodyStr) > 10*1024*1024 {
		return ResponseMsg{Body: "Request body too large (max 10MB)", Status: "Error", Headers: nil, Cookies: nil, Size: 0}
	}

	// We only support a subset of methods with body for now, but standard http.NewRequest handles nil body fine for GET
	reqBody := bytes.NewBuffer([]byte(bodyStr))
	if bodyStr == "" {
		req, err = http.NewRequest(method, urlStr, nil)
	} else {
		req, err = http.NewRequest(method, urlStr, reqBody)
	}

	if err != nil {
		return ResponseMsg{Body: "Failed to create request: " + err.Error(), Status: "Error", Headers: nil, Cookies: nil, Size: 0}
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	// 6. Execute (with timeout to prevent hanging UI)
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return ResponseMsg{Body: "Network Error: " + err.Error(), Status: "Error", Headers: nil, Cookies: nil, Size: 0}
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Printf("Error closing response body: %v", err)
		}
	}()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return ResponseMsg{Body: "Failed to read response body: " + err.Error(), Status: "Error", Headers: nil, Cookies: nil, Size: 0}
	}

	// Check if response is an image and convert to base64 data URL
	contentType := resp.Header.Get("Content-Type")
	var responseBody string
	if contentType != "" && strings.HasPrefix(strings.ToLower(contentType), "image/") {
		// Encode image data as base64 and create data URL
		mimeType := strings.Split(contentType, ";")[0]
		base64Data := base64.StdEncoding.EncodeToString(bodyBytes)
		responseBody = fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
	} else {
		responseBody = string(bodyBytes)
	}

	// Collect response headers - each key-value pair as a separate entry
	var respHeaders []HeaderEntry
	for key, values := range resp.Header {
		for _, v := range values {
			respHeaders = append(respHeaders, HeaderEntry{Key: key, Value: v})
		}
	}

	// Collect cookies from response
	var respCookies []CookieInfo
	for _, cookie := range resp.Cookies() {
		expiresStr := ""
		if !cookie.Expires.IsZero() {
			expiresStr = cookie.Expires.UTC().Format(time.RFC1123)
		}
		respCookies = append(respCookies, CookieInfo{
			Name:     cookie.Name,
			Value:    cookie.Value,
			Domain:   cookie.Domain,
			Path:     cookie.Path,
			Expires:  expiresStr,
			Secure:   cookie.Secure,
			HttpOnly: cookie.HttpOnly,
		})
	}

	// Calculate response size
	size := int64(len(bodyBytes))

	return ResponseMsg{
		Body:    responseBody,
		Status:  resp.Status,
		Headers: respHeaders,
		Cookies: respCookies,
		Size:    size,
	}
}

func (a *App) GetRequests() []Request {
	data := getSavedData()
	result := make([]Request, len(data.Requests))
	copy(result, data.Requests)
	return result
}

func (a *App) SaveRequest(r Request) string {
	err := a.mutateSavedData(func(data *SavedData) {
		if r.Id == "" {
			r.Id = uuid.New().String()
			data.Requests = append(data.Requests, r)
		} else {
			found := false
			for i, savedReq := range data.Requests {
				if savedReq.Id == r.Id {
					data.Requests[i] = r
					found = true
					break
				}
			}
			if !found {
				data.Requests = append(data.Requests, r)
			}
		}
	})
	if err != nil {
		return "Failed to save request: " + err.Error()
	}
	return "Request Saved Successfully"
}

func (a *App) DeleteRequest(id string) error {
	var notFound bool
	err := a.mutateSavedData(func(data *SavedData) {
		index := -1
		for i, req := range data.Requests {
			if req.Id == id {
				index = i
				break
			}
		}
		if index == -1 {
			notFound = true
			return
		}
		data.Requests = append(data.Requests[:index], data.Requests[index+1:]...)
	})
	if err != nil {
		return err
	}
	if notFound {
		return fmt.Errorf("id not found: %s", id)
	}
	return nil
}

func (a *App) GetVariables() string {
	vars := getSavedData().Variables
	if vars == "" {
		return "{}"
	}
	return vars
}

func (a *App) SaveVariables(variableString string) string {
	// Validate JSON and coerce non-string values to strings (e.g. {"count": 5} -> {"count": "5"})
	var rawVars map[string]any
	if err := json.Unmarshal([]byte(variableString), &rawVars); err != nil {
		return "Error: Invalid JSON structure"
	}

	coerced := coerceVariables(rawVars)
	coercedJSON, err := json.Marshal(coerced)
	if err != nil {
		return "Error: Failed to encode variables"
	}

	coercedStr := string(coercedJSON)
	if err := a.mutateSavedData(func(data *SavedData) {
		data.Variables = coercedStr
	}); err != nil {
		return "Failed to save variables: " + err.Error()
	}
	return "Environment Variables Saved Successfully"
}

func (a *App) GetFolders() []Folder {
	data := getSavedData()
	result := make([]Folder, len(data.Folders))
	copy(result, data.Folders)
	return result
}

func (a *App) SaveFolders(folders []Folder) string {
	if folders == nil {
		folders = []Folder{}
	}
	if err := a.mutateSavedData(func(data *SavedData) {
		data.Folders = folders
	}); err != nil {
		return "Failed to save folders: " + err.Error()
	}
	return "Folders Saved Successfully"
}

func (a *App) GetHistory() []Request {
	data := getSavedData()
	result := make([]Request, len(data.History))
	copy(result, data.History)
	return result
}

func (a *App) SaveHistory(history []Request) string {
	if history == nil {
		history = []Request{}
	}
	if err := a.mutateSavedData(func(data *SavedData) {
		data.History = history
	}); err != nil {
		return "Failed to save history: " + err.Error()
	}
	return "History Saved Successfully"
}

// ResetData clears all saved data (requests + variables) on disk so the app
// returns to an empty state. Used by the desktop reset action.
func (a *App) ResetData() error {
	if err := saveSavedData(SavedData{}); err != nil {
		return err
	}
	return nil
}
