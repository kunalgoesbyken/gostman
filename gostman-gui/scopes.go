package main

import "github.com/kunalgoesbyken/gostman/workspace"

const (
	appSecretScope        = "app"
	globalSecretScope     = "global"
	sharedVariablesScope  = "/collection"
	folderVariablesScope  = "/folders"
	sharedVariablesListId = "collection"
)

func secretScope() string {
	if folder, isFolder := storage.current().(folderStore); isFolder {
		return folder.folder.Root()
	}
	return appSecretScope
}

func (a *App) SaveScopes(globals []Environment, activeGlobalId string, collectionVariables string, collectionVariablesMeta string) error {
	stripped, err := vault.withoutSecrets(globals, globalSecretScope)
	if err != nil {
		return err
	}
	if err := mutateData(func(data *SavedData) {
		data.Globals = stripped
		data.ActiveGlobalId = activeGlobalId
	}); err != nil {
		return err
	}
	plain, err := vault.withoutSharedSecrets(secretScope(), collectionVariables, collectionVariablesMeta)
	if err != nil {
		return err
	}
	return storage.current().saveVariables(plain, collectionVariablesMeta)
}

func sharedVariablesList(variables, meta string) []Environment {
	return []Environment{{Id: sharedVariablesListId, Variables: variables, Meta: meta}}
}

func (v *secretVault) withoutSharedSecrets(scope, variables, meta string) (string, error) {
	stripped, err := v.withoutSecrets(sharedVariablesList(variables, meta), scope+sharedVariablesScope)
	if err != nil {
		return "", err
	}
	return stripped[0].Variables, nil
}

func (v *secretVault) withSharedSecrets(variables, meta string) string {
	return v.withSecrets(sharedVariablesList(variables, meta), secretScope()+sharedVariablesScope)[0].Variables
}

func folderVariableLists(folders []Folder) []Environment {
	lists := make([]Environment, len(folders))
	for i, folder := range folders {
		lists[i] = Environment{Id: folder.Id, Variables: folder.CollectionVariables, Meta: folder.CollectionVariablesMeta}
	}
	return lists
}

func withFolderVariableLists(folders []Folder, lists []Environment) []Folder {
	updated := make([]Folder, len(folders))
	for i, folder := range folders {
		updated[i] = folder
		updated[i].CollectionVariables = lists[i].Variables
	}
	return updated
}

func (v *secretVault) withoutFolderSecrets(folders []Folder) ([]Folder, error) {
	stripped, err := v.withoutSecrets(folderVariableLists(folders), secretScope()+folderVariablesScope)
	if err != nil {
		return nil, err
	}
	return withFolderVariableLists(folders, stripped), nil
}

func (v *secretVault) withFolderSecrets(folders []Folder) []Folder {
	return withFolderVariableLists(folders, v.withSecrets(folderVariableLists(folders), secretScope()+folderVariablesScope))
}

func (a *App) SaveCollectionSettings(settings workspace.Settings) error {
	return storage.current().saveSettings(settings)
}
