package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const defaultEnvironmentName = "Default"

type App struct {
	ctx context.Context

	inFlightMu sync.Mutex
	inFlight   map[string]context.CancelFunc

	links linkInbox

	frameless bool
}

func NewApp(frameless bool) *App {
	return &App{inFlight: map[string]context.CancelFunc{}, frameless: frameless}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	startBackups()
	a.loadNetwork()
	restoreWorkspace()
	go diskWatch.watch(a.announceDiskChange)
	a.receiveLaunchArguments()
}

type SavedData struct {
	Variables           string              `json:"variables,omitempty"`
	Environments        []Environment       `json:"environments"`
	ActiveEnvironmentId string              `json:"activeEnvironmentId"`
	Requests            []Request           `json:"requests"`
	Folders             []Folder            `json:"folders"`
	History             []HistoryEntry      `json:"history"`
	Cookies             []engine.CookieInfo `json:"cookies"`
	Settings            Settings            `json:"settings"`
	Restricted          bool                `json:"restricted,omitempty"`

	Globals                 []Environment      `json:"globals,omitempty"`
	ActiveGlobalId          string             `json:"activeGlobalId,omitempty"`
	CollectionVariables     string             `json:"collectionVariables,omitempty"`
	CollectionVariablesMeta string             `json:"collectionVariablesMeta,omitempty"`
	DotEnv                  map[string]string  `json:"dotEnv,omitempty"`
	CollectionSettings      workspace.Settings `json:"collectionSettings"`
	SharedOrder             bool               `json:"sharedOrder,omitempty"`
}

type Environment struct {
	Id        string `json:"id"`
	Name      string `json:"name"`
	Variables string `json:"variables"`
	Color     string `json:"color"`
	Extends   string `json:"extends"`
	Meta      string `json:"meta"`
	FolderId  string `json:"folderId,omitempty"`
}

type Folder struct {
	Id        string   `json:"id"`
	Name      string   `json:"name"`
	IsOpen    bool     `json:"isOpen"`
	ParentId  string   `json:"parentId"`
	SortOrder int64    `json:"sortOrder"`
	Variables string   `json:"variables"`
	Color     string   `json:"color,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	workspace.Settings
	CollectionVariables     string `json:"collectionVariables,omitempty"`
	CollectionVariablesMeta string `json:"collectionVariablesMeta,omitempty"`
}

type Request struct {
	Id               string         `json:"id"`
	Name             string         `json:"name"`
	Description      string         `json:"description"`
	Tags             []string       `json:"tags,omitempty"`
	URL              string         `json:"url"`
	Method           string         `json:"method"`
	Headers          string         `json:"headers"`
	Body             string         `json:"body"`
	BodyType         string         `json:"bodyType"`
	QueryParams      string         `json:"queryParams"`
	FolderId         string         `json:"folderId"`
	GraphqlQuery     string         `json:"graphqlQuery"`
	GraphqlVariables string         `json:"graphqlVariables"`
	Auth             engine.Auth    `json:"auth"`
	Options          engine.Options `json:"options"`
	Extractors       string         `json:"extractors"`
	Assertions       string         `json:"assertions"`
	Examples         string         `json:"examples"`
	PreScript        string         `json:"preScript"`
	PostScript       string         `json:"postScript"`
	GrpcMethod       string         `json:"grpcMethod"`
	GrpcMessage      string         `json:"grpcMessage"`
	GrpcProtos       string         `json:"grpcProtos"`
	McpMethod        string         `json:"mcpMethod"`
	McpTool          string         `json:"mcpTool"`
	McpArguments     string         `json:"mcpArguments"`
	SocketProtocol   string         `json:"socketProtocol"`
	SocketMessages   string         `json:"socketMessages"`
	Vars             string         `json:"vars"`
	Timestamp        string         `json:"timestamp"`
	SortOrder        int64          `json:"sortOrder"`
}

type HistoryEntry struct {
	Request
	StatusCode int  `json:"statusCode,omitempty"`
	NoResponse bool `json:"noResponse,omitempty"`
}

var (
	appFolder    = appDataPath()
	jsonfilePath = filepath.Join(appFolder, "gostman.json")
	dataMutex    sync.RWMutex
)

func appDataPath() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(os.Getenv("APPDATA"), "Gostman")
	}
	return filepath.Join(os.Getenv("HOME"), ".local", "share", "Gostman")
}

func readData() (SavedData, error) {
	var data SavedData
	file, err := os.ReadFile(jsonfilePath)
	if errors.Is(err, fs.ErrNotExist) || (err == nil && len(file) == 0) {
		return data, nil
	}
	if err != nil {
		return data, fmt.Errorf("failed to read data file: %w", err)
	}
	if err := json.Unmarshal(file, &data); err != nil {
		return data, fmt.Errorf("data file is corrupted: %w", err)
	}
	return data, nil
}

func writeData(data SavedData) error {
	if err := os.MkdirAll(appFolder, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	encoded, err := json.MarshalIndent(data, "", " ")
	if err != nil {
		return fmt.Errorf("failed to encode data: %w", err)
	}
	return writeDataFile(encoded)
}

func writeDataFile(encoded []byte) error {
	temporary := jsonfilePath + ".tmp"
	if err := os.WriteFile(temporary, encoded, 0644); err != nil {
		return fmt.Errorf("failed to write data file: %w", err)
	}
	if err := os.Rename(temporary, jsonfilePath); err != nil {
		return fmt.Errorf("failed to replace data file: %w", err)
	}
	return nil
}

func mutateData(mutate func(data *SavedData)) error {
	dataMutex.Lock()
	defer dataMutex.Unlock()

	data, err := readData()
	if err != nil {
		return err
	}
	mutate(&data)
	return writeData(data)
}

func withDefaultEnvironment(data SavedData) SavedData {
	if len(data.Environments) == 0 {
		variables := data.Variables
		if variables == "" {
			variables = "{}"
		}
		data.Environments = []Environment{{Id: uuid.NewString(), Name: defaultEnvironmentName, Variables: variables}}
	}
	if !hasEnvironment(data.Environments, data.ActiveEnvironmentId) {
		data.ActiveEnvironmentId = data.Environments[0].Id
	}
	data.Variables = ""
	return data
}

func hasEnvironment(environments []Environment, id string) bool {
	for _, environment := range environments {
		if environment.Id == id {
			return true
		}
	}
	return false
}

func (a *App) LoadData() (SavedData, error) {
	dataMutex.RLock()
	defer dataMutex.RUnlock()

	data, err := readData()
	if err != nil {
		return SavedData{}, err
	}
	data, err = storage.current().collection(data)
	if err != nil {
		return SavedData{}, err
	}
	data = withDefaultEnvironment(data)
	if !data.Restricted {
		data.Environments = vault.withSecrets(data.Environments, secretScope())
		data.Globals = vault.withSecrets(data.Globals, globalSecretScope)
		data.CollectionVariables = vault.withSharedSecrets(data.CollectionVariables, data.CollectionVariablesMeta)
		data.Folders = vault.withFolderSecrets(data.Folders)
	}
	if data.Requests == nil {
		data.Requests = []Request{}
	}
	if data.Folders == nil {
		data.Folders = []Folder{}
	}
	if data.History == nil {
		data.History = []HistoryEntry{}
	}
	if data.Cookies == nil {
		data.Cookies = []engine.CookieInfo{}
	}
	if data.Settings.Certificates == nil {
		data.Settings.Certificates = []CertificateFiles{}
	}
	return data, nil
}

func (a *App) SaveRequest(request Request) (Request, error) {
	saved, err := a.SaveRequests([]Request{request})
	if err != nil {
		return Request{}, err
	}
	return saved[0], nil
}

func (a *App) SaveRequests(requests []Request) ([]Request, error) {
	for i := range requests {
		if requests[i].Id == "" {
			requests[i].Id = uuid.NewString()
		}
	}
	return requests, storage.current().saveRequests(requests)
}

func (a *App) DeleteRequests(ids []string) error {
	return storage.current().deleteRequests(ids)
}

func (a *App) SaveFolders(folders []Folder) error {
	stripped, err := vault.withoutFolderSecrets(folders)
	if err != nil {
		return err
	}
	return storage.current().saveFolders(stripped)
}

func (a *App) ShareSiblingOrder() error {
	return storage.current().shareOrder()
}

func (a *App) SaveHistory(history []HistoryEntry) error {
	return mutateData(func(data *SavedData) {
		data.History = history
	})
}

func (a *App) SaveEnvironments(environments []Environment, activeId string) error {
	stripped, err := vault.withoutSecrets(environments, secretScope())
	if err != nil {
		return err
	}
	return storage.current().saveEnvironments(stripped, activeId)
}

func (a *App) ResetData() error {
	a.stopServers(a.ctx)
	captureJournal.Clear()
	if err := resetData(); err != nil {
		return err
	}
	a.loadNetwork()
	return nil
}

func resetData() error {
	dataMutex.Lock()
	defer dataMutex.Unlock()
	if err := forgetWorkspaces(); err != nil {
		return err
	}
	if err := forgetSecrets(); err != nil {
		return err
	}
	if err := forgetBackups(); err != nil {
		return err
	}
	if err := removeIfPresent(filepath.Join(appFolder, mockAppDataFile)); err != nil {
		return err
	}
	return writeData(SavedData{})
}

func removeIfPresent(paths ...string) error {
	for _, path := range paths {
		if err := os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
			return err
		}
	}
	return nil
}

func (a *App) SendRequest(id string, request engine.Request) engine.Response {
	ctx, cancel := context.WithCancel(a.ctx)
	a.track(id, cancel)
	defer a.release(id)

	return engine.Send(ctx, request, a.sendPolicy())
}

func (a *App) CancelRequest(id string) {
	a.inFlightMu.Lock()
	defer a.inFlightMu.Unlock()
	if cancel, ok := a.inFlight[id]; ok {
		cancel()
	}
}

func (a *App) track(id string, cancel context.CancelFunc) {
	a.inFlightMu.Lock()
	defer a.inFlightMu.Unlock()
	a.inFlight[id] = cancel
}

func (a *App) release(id string) {
	a.inFlightMu.Lock()
	defer a.inFlightMu.Unlock()
	if cancel, ok := a.inFlight[id]; ok {
		cancel()
		delete(a.inFlight, id)
	}
}

func (a *App) PrepareRequest(request engine.Request) (engine.Prepared, error) {
	return engine.Prepare(request)
}

func (a *App) ExpandTexts(texts []string, variables string) ([]string, error) {
	return engine.ExpandTexts(texts, variables)
}

func (a *App) SaveFile(suggestedName, base64Data string) (bool, error) {
	content, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return false, fmt.Errorf("file content is not valid base64: %w", err)
	}
	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{DefaultFilename: safeFileName(suggestedName)})
	if err != nil || path == "" {
		return false, err
	}
	return true, os.WriteFile(path, content, 0644)
}

func (a *App) ParseCurl(command string) (engine.Request, error) {
	return engine.ParseCurl(command)
}

func safeFileName(name string) string {
	base := filepath.Base(filepath.FromSlash(strings.ReplaceAll(name, `\`, "/")))
	if strings.Trim(base, ". ") == "" || base == string(filepath.Separator) {
		return "download"
	}
	return base
}
