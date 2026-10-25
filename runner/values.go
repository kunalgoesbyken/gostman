package runner

import (
	"maps"
	"slices"
	"strings"
	"sync"
)

const (
	scopeCollection  = "collection"
	scopeGlobal      = "global"
	scopeEnvironment = "environment"
	rootList         = ""
)

type scriptLayer struct {
	Scope  string    `json:"scope"`
	Values variables `json:"values"`
}

type environmentSlot struct {
	name      string
	inherited variables
	own       variables
}

type values struct {
	mu           sync.Mutex
	process      variables
	globals      variables
	collection   variables
	edits        map[string]variables
	environments map[string]*environmentSlot
	chosen       map[string]string
	primary      string
	session      variables
	focus        []Folder
}

func newValues() *values {
	return &values{
		process:      variables{},
		globals:      variables{},
		collection:   variables{},
		edits:        map[string]variables{},
		environments: map[string]*environmentSlot{"": {inherited: variables{}, own: variables{}}},
		chosen:       map[string]string{},
		session:      variables{},
	}
}

func collectionOf(lineage []Folder) string {
	if len(lineage) < 2 {
		return ""
	}
	return lineage[1].ID
}

func holders(lineage []Folder) []Folder {
	var owners []Folder
	for _, folder := range lineage {
		if folder.ID != "" && folder.CollectionVariables != "" {
			owners = append(owners, folder)
		}
	}
	return owners
}

func edited(base, changes variables) variables {
	result := layered(base)
	result.change(changes)
	return result
}

func (v *values) slot(lineage []Folder) *environmentSlot {
	if id, found := v.chosen[collectionOf(lineage)]; found {
		return v.environments[id]
	}
	return v.environments[v.primary]
}

func (v *values) collectionLists(lineage []Folder) []variables {
	lists := []variables{edited(v.collection, v.edits[rootList])}
	for _, holder := range holders(lineage) {
		own, err := Environment{Variables: holder.CollectionVariables, Meta: holder.CollectionVariablesMeta}.ownScope()
		if err != nil {
			own = variables{}
		}
		lists = append(lists, edited(own, v.edits[holder.ID]))
	}
	return lists
}

func (v *values) layers(lineage []Folder) []variables {
	environment := v.slot(lineage)
	scopes := append([]variables{v.process, v.globals}, v.collectionLists(lineage)...)
	return append(scopes, environment.inherited, environment.own)
}

func (v *values) scoped(request Request, once variables) variables {
	v.mu.Lock()
	defer v.mu.Unlock()
	scopes := append(v.layers(request.Lineage), request.folderScopes()...)
	return layered(append(scopes, requestScope(request.Vars), v.session, once)...)
}

func (v *values) scriptLayers(request Request, once variables) []scriptLayer {
	v.mu.Lock()
	defer v.mu.Unlock()
	environment := v.slot(request.Lineage)
	return []scriptLayer{
		{Values: layered(v.process)},
		{Scope: scopeGlobal, Values: layered(v.globals)},
		{Scope: scopeCollection, Values: layered(v.collectionLists(request.Lineage)...)},
		{Scope: scopeEnvironment, Values: layered(environment.inherited, environment.own)},
		{Values: layered(append(request.folderScopes(), requestScope(request.Vars))...)},
		{Scope: scopeSession, Values: layered(v.session)},
		{Values: layered(once)},
	}
}

func (v *values) known() variables {
	v.mu.Lock()
	defer v.mu.Unlock()
	return layered(v.layers(v.focus)...)
}

func (v *values) current() variables {
	v.mu.Lock()
	defer v.mu.Unlock()
	return layered(append(v.layers(v.focus), v.session)...)
}

func (v *values) environmentName(lineage []Folder) string {
	v.mu.Lock()
	defer v.mu.Unlock()
	return v.slot(lineage).name
}

func (v *values) editCollection(lineage []Folder, changes variables) {
	target := rootList
	if owners := holders(lineage); len(owners) > 0 {
		target = owners[len(owners)-1].ID
	}
	if v.edits[target] == nil {
		v.edits[target] = variables{}
	}
	v.edits[target].merge(changes)
}

func (v *values) write(lineage []Folder, writes scopedWrites) {
	v.mu.Lock()
	defer v.mu.Unlock()
	for scope, changes := range writes {
		switch scope {
		case scopeSession:
			continue
		case scopeCollection:
			v.editCollection(lineage, changes)
		case scopeGlobal:
			v.globals.change(changes)
		default:
			v.slot(lineage).own.change(changes)
		}
		v.session.forget(changes.withValues())
	}
	v.session.change(writes[scopeSession])
}

func (v *values) load(process, collection variables) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.process, v.collection = process, collection
}

func (v *values) useEnvironments(primary string, slots map[string]*environmentSlot, chosen map[string]string, focus []Folder) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.primary, v.environments, v.chosen, v.focus = primary, slots, chosen, focus
	v.session = variables{}
}

func (v *values) focusOn(focus []Folder) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.focus = focus
}

func (v *values) setEnvironment(overrides map[string]string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	for _, slot := range v.environments {
		slot.own.override(overrides)
	}
}

func (v *values) remember(overrides map[string]string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.session.override(overrides)
}

func (v *values) primaryName() string {
	v.mu.Lock()
	defer v.mu.Unlock()
	return v.environments[v.primary].name
}

func (v *values) environmentNames() string {
	v.mu.Lock()
	defer v.mu.Unlock()
	names := []string{}
	for _, id := range append([]string{v.primary}, slices.Sorted(maps.Values(v.chosen))...) {
		if name := v.environments[id].name; name != "" && !slices.Contains(names, name) {
			names = append(names, name)
		}
	}
	return strings.Join(names, ", ")
}

func (v *values) giver() func(Row) {
	v.mu.Lock()
	before := layered(v.session)
	v.mu.Unlock()
	var given Row
	return func(next Row) {
		v.mu.Lock()
		defer v.mu.Unlock()
		v.session.withdraw(given, before)
		v.session.merge(variables(next))
		given = next
	}
}
