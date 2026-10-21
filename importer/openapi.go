package importer

import (
	"context"

	"github.com/krockxz/gostman/openapi"
	"github.com/krockxz/gostman/workspace"
)

func (c *collector) readOpenAPI(ctx context.Context, doc document, config Config) {
	loaded, err := openapi.Load(ctx, openapi.Source{Text: doc.file.Text}, config.OpenAPI)
	if err != nil {
		c.skip("%s: %v", doc.file.Name, err)
		return
	}
	generated := loaded.Generate(openapi.Selection{})
	c.read(generated.Title, FormatOpenAPI, func() {
		folderIDs := map[string]string{}
		for _, folder := range generated.Folders {
			folderIDs[folder.ID] = c.addFolder(folder.Name, folderIDs[folder.ParentID])
		}
		for _, request := range generated.Requests {
			c.addRequest(openAPIRequest(request, folderIDs[request.FolderID]))
		}
		for name, value := range generated.Variables {
			if _, taken := c.Variables[name]; !taken {
				c.Variables[name] = value
			}
		}
		c.Warnings = append(c.Warnings, generated.Warnings...)
	})
}

func openAPIRequest(source openapi.Request, folderID string) workspace.Request {
	request := newRequest(source.Name, source.Method, source.URL)
	request.Description = source.Description
	request.Headers = source.Headers
	request.Body = source.Body
	request.BodyType = source.BodyType
	request.QueryParams = source.QueryParams
	request.FolderId = folderID
	request.Auth = source.Auth
	request.Examples = source.Examples
	return request
}
