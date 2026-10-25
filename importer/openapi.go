package importer

import (
	"context"

	"github.com/kunalgoesbyken/gostman/locales"
	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/workspace"
)

func (c *collector) readOpenAPI(ctx context.Context, doc document, config Config) {
	loaded, err := openapi.Load(ctx, openapi.Source{Text: doc.file.Text}, config.OpenAPI)
	if err != nil {
		c.skip(locales.ImporterSkipFileError, locales.Params{"file": doc.file.Name, "detail": err.Error()})
		return
	}
	generated := loaded.Generate(openapi.Selection{})
	c.read(generated.Title, FormatOpenAPI, func() { c.addGenerated(generated) })
}

func (c *collector) addGenerated(generated openapi.Collection) {
	folderIDs := map[string]string{}
	for _, folder := range generated.Folders {
		folderIDs[folder.ID] = c.addFolder(folder.Name, folderIDs[folder.ParentID])
	}
	for _, request := range generated.Requests {
		c.addRequest(openAPIRequest(request, folderIDs[request.FolderID]))
	}
	if len(generated.Folders) > 0 {
		c.ownCollectionVariables(folderIDs[generated.Folders[0].ID], generated.Variables)
	} else {
		c.shareVariables(generated.Variables)
	}
	c.leadText(generated.Warnings)
}

func openAPIRequest(source openapi.Request, folderID string) workspace.Request {
	request := newRequest(source.Name, source.Method, source.URL)
	request.Description = source.Description
	request.Tags = workspace.NormalizeTags(source.Tags)
	request.Headers = source.Headers
	request.Body = source.Body
	request.BodyType = source.BodyType
	request.QueryParams = source.QueryParams
	request.FolderId = folderID
	request.Auth = source.Auth
	request.Examples = source.Examples
	request.Vars = source.Vars
	return request
}
