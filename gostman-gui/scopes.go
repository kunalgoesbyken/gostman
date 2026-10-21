package main

const (
	appSecretScope    = "app"
	globalSecretScope = "global"
)

func secretScope() string {
	if folder, isFolder := storage.current().(folderStore); isFolder {
		return folder.folder.Root()
	}
	return appSecretScope
}

func (a *App) SaveScopes(globals []Environment, activeGlobalId string, collectionVariables string) error {
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
	return storage.current().saveVariables(collectionVariables)
}
