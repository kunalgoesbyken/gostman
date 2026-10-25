package agent

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/importer"
	"github.com/kunalgoesbyken/gostman/mcpclient"
	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/scan"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	formatCurl     = "curl"
	authOAuth2     = "oauth2"
	importedName   = "import"
	shownImported  = 50
	shownRefusals  = 5
	curlCommand    = "curl"
	leftOutScripts = "scripts"
	leftOutOAuth   = "OAuth 2.0 settings"
	keptSettings   = "collection settings, because the collection already has its own"
	referenceMark  = "ref"
)

type importArguments struct {
	documentArguments
	Format string `json:"format"`
	Folder string `json:"folder"`
}

type importedLine struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Folder string `json:"folder,omitempty"`
	Method string `json:"method"`
	URL    string `json:"url"`
}

type importReport struct {
	Sources      []importer.Source   `json:"sources"`
	Folder       string              `json:"folder,omitempty"`
	Folders      int                 `json:"folders"`
	Requests     []importedLine      `json:"requests"`
	MoreRequests int                 `json:"moreRequests,omitempty"`
	Settings     bool                `json:"collectionSettings,omitempty"`
	Environments []string            `json:"environments,omitempty"`
	Variables    []string            `json:"variables,omitempty"`
	ByCollection map[string][]string `json:"collectionVariables,omitempty"`
	LeftOut      []string            `json:"leftOut,omitempty"`
	Warnings     []string            `json:"warnings,omitempty"`
	Notes        []string            `json:"notes,omitempty"`
	Skipped      []string            `json:"skipped,omitempty"`
}

func (a importArguments) format() string {
	if a.Format == "" {
		return importer.FormatAuto
	}
	return a.Format
}

func (d *Desk) importText(ctx context.Context, arguments importArguments) (string, error) {
	source, err := arguments.source()
	if err != nil || hasText(source.Text) {
		return source.Text, err
	}
	data, err := openapi.Fetch(ctx, source.URL, openapi.Options{Policy: d.client.policy, MaxBytes: importer.DefaultMaxBytes})
	if err != nil {
		return "", fmt.Errorf("%s could not be fetched: %w", source.URL, err)
	}
	return importer.DecodeText(data)
}

func isCurl(text, format string) bool {
	if format == formatCurl {
		return true
	}
	first, _, _ := strings.Cut(strings.TrimSpace(text), " ")
	return format == importer.FormatAuto && strings.EqualFold(first, curlCommand)
}

func curlName(request engine.Request) string {
	parsed, err := url.Parse(request.URL)
	if err != nil || parsed.Path == "" {
		return request.Method + " " + request.URL
	}
	return request.Method + " " + parsed.Path
}

func fromCurl(text string) (importer.Result, error) {
	parsed, err := engine.ParseCurl(strings.TrimSpace(text))
	if err != nil {
		return importer.Result{}, fmt.Errorf("The curl command cannot be read: %w", err)
	}
	request := workspace.BlankRequest(rand.Text())
	request.Name = curlName(parsed)
	request.Method = methodOrDefault(parsed.Method)
	request.URL = parsed.URL
	request.Headers = parsed.Headers
	request.QueryParams = parsed.QueryParams
	request.Body = parsed.Body
	request.BodyType = parsed.BodyType
	if parsed.Auth.Type != "" {
		request.Auth = parsed.Auth
	}
	request.Options = parsed.Options
	source := importer.Source{Name: request.Name, Format: formatCurl, Requests: 1}
	return importer.Result{Sources: []importer.Source{source}, Requests: []workspace.Request{request}}, nil
}

func (d *Desk) parseImport(ctx context.Context, text, format string) (importer.Result, error) {
	if isCurl(text, format) {
		return fromCurl(text)
	}
	files := []importer.File{{Name: importedName, Text: text}}
	config := importer.Config{OpenAPI: openapi.Options{Policy: d.client.policy}, MaxBytes: importer.DefaultMaxBytes}
	return importer.Import(ctx, files, format, importer.Options{}, config)
}

func readsFilesAnywhere(result importer.Result) bool {
	encoded, err := json.Marshal(result)
	return err != nil || engine.ReadsFiles(string(encoded))
}

func runsCommands(requests []workspace.Request) bool {
	for _, request := range requests {
		if mcpclient.IsCommand(request.URL) {
			return true
		}
	}
	return false
}

func disarm(pre, post *string, auth *engine.Auth, label string) []string {
	var removed []string
	if hasText(*pre) || hasText(*post) {
		*pre, *post = "", ""
		removed = append(removed, leftOutScripts)
	}
	if auth.Type == authOAuth2 {
		*auth = workspace.BlankRequest("").Auth
		removed = append(removed, leftOutOAuth)
	}
	if len(removed) == 0 {
		return nil
	}
	return []string{fmt.Sprintf("%s of %s", strings.Join(removed, " and "), label)}
}

func disarmAll(result *importer.Result) []string {
	var notes []string
	if settings := result.Settings; settings != nil {
		notes = append(notes, disarm(&settings.PreScript, &settings.PostScript, &settings.Auth, "the collection")...)
	}
	for index := range result.Folders {
		folder := &result.Folders[index]
		notes = append(notes, disarm(&folder.PreScript, &folder.PostScript, &folder.Auth, fmt.Sprintf("folder %q", folder.Name))...)
	}
	for index := range result.Requests {
		request := &result.Requests[index]
		notes = append(notes, disarm(&request.PreScript, &request.PostScript, &request.Auth, fmt.Sprintf("request %q", request.Name))...)
	}
	return notes
}

func withoutSecretValues(result *importer.Result) []string {
	result.Environments = append(result.Environments, result.Globals...)
	result.Globals = nil
	var notes []string
	for index, environment := range result.Environments {
		stripped, removed := workspace.WithoutSecretValues(environment)
		result.Environments[index] = stripped
		if len(removed) > 0 {
			notes = append(notes, fmt.Sprintf("values of the secret variables %s in environment %q; the developer sets them in the app or passes them with --var-from-env", strings.Join(removed, ", "), environment.Name))
		}
	}
	return notes
}

func (d *Desk) refuseCredentials(current scene, text string, result importer.Result) error {
	if err := d.refuseCredentialValues([]string{text}, secretNames(current.files.Environments)); err != nil {
		return err
	}
	for _, request := range result.Requests {
		if header, found := literalCredential(headerList(request.Headers)); found {
			return fmt.Errorf("Not imported: request %q has a literal %s header. Replace the credential with a {{variable}} and import again.", request.Name, header)
		}
	}
	collection, err := result.Collection()
	if err != nil {
		return err
	}
	report := scan.Scan(collection, scan.Options{})
	if len(report.Findings) == 0 {
		return nil
	}
	places := make([]string, 0, shownRefusals)
	for _, finding := range report.Findings[:min(len(report.Findings), shownRefusals)] {
		places = append(places, fmt.Sprintf("%s %s (%s)", finding.Location.Path, finding.Location.Field, finding.Reason))
	}
	return fmt.Errorf("Not imported: it holds %d value(s) that look like credentials: %s. Replace them with {{variables}} and import again.", len(report.Findings), strings.Join(places, "; "))
}

func (d *Desk) checkImport(current scene, text string, result importer.Result) error {
	switch {
	case readsFilesAnywhere(result):
		return errors.New("Not imported: it uses {{$file(...)}}, which reads files on this computer, so only the developer can import it, in the app or with gostman import.")
	case runsCommands(result.Requests):
		return errors.New("Not imported: it holds requests that run local commands (stdio: addresses), so only the developer can import it, in the app or with gostman import.")
	}
	return d.refuseCredentials(current, text, result)
}

func rehome(result *importer.Result, parentID string) {
	for index := range result.Folders {
		if result.Folders[index].ParentId == "" {
			result.Folders[index].ParentId, result.Folders[index].SortOrder = parentID, 0
		}
	}
	for index := range result.Requests {
		if result.Requests[index].FolderId == "" {
			result.Requests[index].FolderId, result.Requests[index].SortOrder = parentID, 0
		}
	}
}

func (d *Desk) storeFolders(current scene, result *importer.Result, path string) (string, error) {
	plan, err := d.planFolders(current.files.Folders, path)
	if err != nil {
		return "", err
	}
	rehome(result, plan.parentID)
	if err := d.markFolderValues(result.Folders); err != nil {
		return "", err
	}
	joined := strings.Join(plan.segments, folderDivider)
	if len(result.Folders) == 0 && !plan.grown {
		return joined, nil
	}
	return joined, d.files.SaveFolders(append(plan.folders, result.Folders...))
}

func (d *Desk) markFolderValues(folders []workspace.Folder) error {
	for _, folder := range folders {
		if err := d.files.MarkAgentVariables(folder.Id, currentValues(folder.Variables)); err != nil {
			return err
		}
		if err := d.files.MarkAgentVariables(collectionListOf(folder.Id), currentValues(folder.CollectionVariables)); err != nil {
			return err
		}
	}
	return nil
}

func (d *Desk) storeRequests(requests []workspace.Request) error {
	if len(requests) == 0 {
		return nil
	}
	ids := make([]string, 0, len(requests))
	for _, request := range requests {
		ids = append(ids, request.Id)
	}
	if err := d.files.MarkAgentAuthored(ids...); err != nil {
		return err
	}
	return d.files.SaveRequests(requests)
}

func withoutReferences(meta string) string {
	var marks map[string]map[string]json.RawMessage
	if json.Unmarshal([]byte(meta), &marks) != nil || marks == nil {
		return emptyObject
	}
	for name, mark := range marks {
		delete(mark, referenceMark)
		if len(mark) == 0 {
			delete(marks, name)
		}
	}
	encoded, err := json.Marshal(marks)
	if err != nil {
		return emptyObject
	}
	return string(encoded)
}

func environmentNamed(environments []workspace.Environment, name string) int {
	for index, environment := range environments {
		if environment.Name == name {
			return index
		}
	}
	return -1
}

func (d *Desk) storeEnvironments(current scene, imported []workspace.Environment) ([]string, error) {
	if len(imported) == 0 {
		return nil, nil
	}
	environments := append([]workspace.Environment{}, current.files.Environments...)
	var names []string
	for _, environment := range imported {
		position := environmentNamed(environments, environment.Name)
		if position < 0 {
			environments = append(environments, workspace.Environment{Id: environment.Id, Name: environment.Name, Variables: emptyObject, Meta: withoutReferences(environment.Meta), Color: environment.Color, Extends: environment.Extends})
			position = len(environments) - 1
		}
		target := &environments[position]
		text, written, err := withValues(target.Variables, currentValues(environment.Variables), false)
		if err != nil {
			return nil, fmt.Errorf("environment %q: %w", environment.Name, err)
		}
		if err := d.files.MarkAgentVariables(target.Id, written); err != nil {
			return nil, err
		}
		target.Variables = text
		names = append(names, environment.Name)
	}
	return names, d.files.SaveEnvironments(environments)
}

func (d *Desk) storeVariables(values map[string]string) ([]string, error) {
	if len(values) == 0 {
		return nil, nil
	}
	text, written, err := withValues(d.files.Variables(), values, false)
	if err != nil || len(written) == 0 {
		return nil, err
	}
	if err := d.files.MarkAgentVariables(collectionScope, written); err != nil {
		return nil, err
	}
	return sortedKeys(written), d.files.SaveVariables(text)
}

func describeImport(result importer.Result, notes []string, pathOf func(string) string) importReport {
	report := importReport{
		Sources:  result.Sources,
		Folders:  len(result.Folders),
		Requests: []importedLine{},
		LeftOut:  notes,
		Warnings: result.Warnings,
		Notes:    result.Notes,
		Skipped:  result.Skipped,
	}
	for index, request := range result.Requests {
		if index == shownImported {
			report.MoreRequests = len(result.Requests) - shownImported
			break
		}
		report.Requests = append(report.Requests, importedLine{ID: request.Id, Name: request.Name, Folder: pathOf(request.FolderId), Method: request.Method, URL: request.URL})
	}
	report.ByCollection = collectionVariableNames(result.Folders, pathOf)
	return report
}

func collectionVariableNames(folders []workspace.Folder, pathOf func(string) string) map[string][]string {
	names := map[string][]string{}
	for _, folder := range folders {
		entries, _ := workspace.ParseVariableEntries(folder.CollectionVariables)
		for _, entry := range entries {
			names[pathOf(folder.Id)] = append(names[pathOf(folder.Id)], entry.Name)
		}
	}
	if len(names) == 0 {
		return nil
	}
	return names
}

func (d *Desk) importRequests(ctx context.Context, current scene, arguments importArguments) (importReport, error) {
	text, err := d.importText(ctx, arguments)
	if err != nil {
		return importReport{}, err
	}
	result, err := d.parseImport(ctx, text, arguments.format())
	if err != nil {
		return importReport{}, err
	}
	notes := append(disarmAll(&result), withoutSecretValues(&result)...)
	if err := d.checkImport(current, text, result); err != nil {
		return importReport{}, err
	}
	if err := d.files.ShareOrder(); err != nil {
		return importReport{}, err
	}
	current.files = d.files.Collection()
	folder, err := d.storeFolders(current, &result, arguments.Folder)
	if err != nil {
		return importReport{}, err
	}
	if err := d.storeRequests(result.Requests); err != nil {
		return importReport{}, err
	}
	report := describeImport(result, notes, folderPaths(d.files.Collection().Folders))
	report.Folder = folder
	if report.Environments, err = d.storeEnvironments(current, result.Environments); err != nil {
		return importReport{}, err
	}
	if report.Variables, err = d.storeVariables(result.Variables); err != nil {
		return importReport{}, err
	}
	report.Settings, err = d.storeSettings(result.Settings, &report)
	return report, err
}

func (d *Desk) storeSettings(imported *workspace.Settings, report *importReport) (bool, error) {
	switch {
	case imported == nil || !importer.CarriesSettings(*imported):
		return false, nil
	case importer.CarriesSettings(d.files.Settings()):
		report.LeftOut = append(report.LeftOut, keptSettings)
		return false, nil
	}
	return true, d.files.SaveSettings(*imported)
}
