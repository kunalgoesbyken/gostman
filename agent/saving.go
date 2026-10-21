package agent

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	folderDivider = "/"
	fileDivider   = `\`
)

var assertionOperators = []string{
	"eq", "neq", "gt", "gte", "lt", "lte", "contains", "notContains", "startsWith", "endsWith", "matches", "in", "length",
	"isDefined", "isUndefined", "isNull", "isEmpty", "isNotEmpty", "isTrue", "isFalse",
	"isNumber", "isString", "isBoolean", "isArray", "isObject",
}

type assertion struct {
	Expression string `json:"expression"`
	Operator   string `json:"operator"`
	Value      string `json:"value"`
	Enabled    bool   `json:"enabled"`
}

type saveArguments struct {
	ID         string             `json:"id"`
	Name       *string            `json:"name"`
	Folder     *string            `json:"folder"`
	Method     *string            `json:"method"`
	URL        *string            `json:"url"`
	Headers    *map[string]string `json:"headers"`
	Body       *string            `json:"body"`
	BodyType   *string            `json:"body_type"`
	Assertions *[]assertion       `json:"assertions"`
}

type saved struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Folder  string `json:"folder"`
	Created bool   `json:"created"`
}

type revision struct {
	request  workspace.Request
	supplied []string
	created  bool
}

func (r *revision) text(target *string, value *string) {
	if value == nil {
		return
	}
	*target = *value
	r.supplied = append(r.supplied, *value)
}

func (d *Desk) blankRequest() (workspace.Request, error) {
	defaults, err := d.client.session.Normalize(struct{}{})
	return workspace.Request{Id: rand.Text(), Auth: defaults.Auth, Options: defaults.Options}, err
}

func (d *Desk) startingPoint(a saveArguments, files workspace.Collection) (revision, error) {
	if a.ID != "" {
		existing := storedRequest(files, a.ID)
		if existing.Id == "" {
			return revision{}, fmt.Errorf("There is no request with the id %q. Leave id out to create a request.", a.ID)
		}
		return revision{request: existing}, nil
	}
	if a.Name == nil || !hasText(*a.Name) || a.URL == nil || !hasText(*a.URL) {
		return revision{}, errors.New("A new request needs a name and a url.")
	}
	blank, err := d.blankRequest()
	return revision{request: blank, created: true}, err
}

func checkAssertions(assertions []assertion) error {
	for _, candidate := range assertions {
		if !slices.Contains(assertionOperators, candidate.Operator) {
			return fmt.Errorf("%q is not an assertion operator; use one of %s.", candidate.Operator, strings.Join(assertionOperators, ", "))
		}
		if !hasText(candidate.Expression) {
			return errors.New("Every assertion needs an expression such as res.status or res.body.id.")
		}
	}
	return nil
}

func (r *revision) headers(headers *map[string]string) error {
	if headers == nil {
		return nil
	}
	entries := headerEntries(*headers)
	for _, header := range entries {
		if isCredentialHeader(header.Key) && isLiteral(header.Value) {
			return fmt.Errorf("Not saved: the %s header holds a literal credential. Keep the credential in an environment variable and reference it, for example \"Bearer {{token}}\".", header.Key)
		}
		r.supplied = append(r.supplied, header.Key, header.Value)
	}
	rows, err := headerRows(entries)
	r.request.Headers = rows
	return err
}

func (r *revision) assertions(assertions *[]assertion) error {
	if assertions == nil {
		return nil
	}
	if err := checkAssertions(*assertions); err != nil {
		return err
	}
	enabled := make([]assertion, 0, len(*assertions))
	for _, candidate := range *assertions {
		candidate.Enabled = true
		enabled = append(enabled, candidate)
		r.supplied = append(r.supplied, candidate.Expression, candidate.Value)
	}
	encoded, err := json.Marshal(enabled)
	r.request.Assertions = string(encoded)
	return err
}

func (r *revision) apply(arguments saveArguments) error {
	r.text(&r.request.Name, arguments.Name)
	r.text(&r.request.URL, arguments.URL)
	r.text(&r.request.Body, arguments.Body)
	if arguments.Method != nil {
		r.request.Method = methodOrDefault(*arguments.Method)
	}
	if arguments.BodyType != nil {
		r.request.BodyType = *arguments.BodyType
	}
	if r.request.Method == "" {
		r.request.Method = methodOrDefault("")
	}
	if err := r.headers(arguments.Headers); err != nil {
		return err
	}
	return r.assertions(arguments.Assertions)
}

func (r revision) check() error {
	if !slices.Contains(textBodyTypes, r.request.BodyType) && r.request.BodyType != "" {
		return fmt.Errorf("Not saved: requests with a %s body carry files and are edited in the Gostman app.", r.request.BodyType)
	}
	if !hasText(r.request.Name) || !hasText(r.request.URL) {
		return errors.New("A request needs a name and a url.")
	}
	return nil
}

func leak(label string) error {
	if strings.HasPrefix(label, hiddenPrefix) {
		return fmt.Errorf("Not saved: the request contains a credential that Gostman keeps hidden (%s). Keep it in an environment variable and write {{name}} where it belongs.", strings.TrimPrefix(label, hiddenPrefix))
	}
	return fmt.Errorf("Not saved: the request contains the value of the variable %q. Write {{%s}} in its place so the value stays out of the workspace files.", label, label)
}

func (d *Desk) refuseSecrets(supplied []string) error {
	for _, text := range supplied {
		if label, found := d.client.guard.Find(text); found {
			return leak(label)
		}
	}
	return nil
}

func folderSegments(path string) ([]string, error) {
	var segments []string
	for _, segment := range strings.Split(path, folderDivider) {
		segment = strings.TrimSpace(segment)
		if segment == "" {
			continue
		}
		if segment == "." || segment == ".." || strings.Contains(segment, fileDivider) {
			return nil, fmt.Errorf("%q is not a folder name. A folder path names folders inside the workspace, such as auth/tokens.", segment)
		}
		segments = append(segments, segment)
	}
	return segments, nil
}

func childFolder(folders []workspace.Folder, parentID, name string) (workspace.Folder, bool) {
	for _, folder := range folders {
		if folder.ParentId == parentID && folder.Name == name {
			return folder, true
		}
	}
	return workspace.Folder{}, false
}

func (d *Desk) ensureFolder(folders []workspace.Folder, segments []string) (string, error) {
	parentID, grown := "", false
	for _, name := range segments {
		folder, found := childFolder(folders, parentID, name)
		if !found {
			folder = workspace.Folder{Id: rand.Text(), Name: name, ParentId: parentID}
			folders, grown = append(folders, folder), true
		}
		parentID = folder.Id
	}
	if !grown {
		return parentID, nil
	}
	return parentID, d.files.SaveFolders(folders)
}

func (d *Desk) place(current scene, change *revision, path *string) error {
	if path == nil {
		return nil
	}
	segments, err := folderSegments(*path)
	if err != nil {
		return err
	}
	if err := d.refuseSecrets(segments); err != nil {
		return err
	}
	change.request.FolderId, err = d.ensureFolder(current.files.Folders, segments)
	return err
}

func (d *Desk) folderPath(id string) string {
	names := map[string]workspace.Folder{}
	for _, folder := range d.files.Collection().Folders {
		names[folder.Id] = folder
	}
	var path []string
	for folder, found := names[id]; found; folder, found = names[folder.ParentId] {
		path = append([]string{folder.Name}, path...)
	}
	return strings.Join(path, folderDivider)
}

func (d *Desk) saveRequest(_ context.Context, current scene, arguments saveArguments) (saved, error) {
	change, err := d.startingPoint(arguments, current.files)
	if err != nil {
		return saved{}, err
	}
	if err := change.apply(arguments); err != nil {
		return saved{}, err
	}
	if err := change.check(); err != nil {
		return saved{}, err
	}
	if err := d.refuseSecrets(change.supplied); err != nil {
		return saved{}, err
	}
	if err := d.place(current, &change, arguments.Folder); err != nil {
		return saved{}, err
	}
	if err := d.files.MarkAgentAuthored(change.request.Id); err != nil {
		return saved{}, err
	}
	if err := d.files.SaveRequests([]workspace.Request{change.request}); err != nil {
		return saved{}, err
	}
	request := change.request
	return saved{ID: request.Id, Name: request.Name, Folder: d.folderPath(request.FolderId), Created: change.created}, nil
}
