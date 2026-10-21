package importer

const (
	messageScripts       = "Scripts were kept in %s. Read them before you run them."
	messageForeignCalls  = "Scripts in %s call pm.* or bru.* functions, which Gostman does not translate. Rewrite them before running."
	messageOAuth         = "OAuth 2 settings were imported for %s without tokens. Authorize again before sending."
	messageAuthDropped   = "The authentication type of %s is not supported and was left out."
	messageAuthType      = "The authentication type %s is not supported and was left out."
	messageFiles         = "Files are not part of an export. Attach them again in %s."
	messageTemplateTags  = "Template tags in %s were kept as text and are not evaluated."
	messageTooMany       = "Only the first %d requests were imported."
	messageTooManyItems  = "Only the first %d items were read; the rest were left out."
	messageAndMore       = "%s and %d more"
	messageEmpty         = "There is nothing to import: no requests, folders or environments were found."
	messageUnknown       = "Could not detect the format. Use an Insomnia, HAR, WSDL, Bruno, Postman or OpenAPI file, or choose the format."
	messageNotFormat     = "%s is not a %s file."
	messageNotRecognized = "%s: format not recognized"
	messageUnresolved    = "%s refers to schema files that were not included: %s"
	messageFolderNotes   = "Folder %q defines %s, which Gostman folders cannot hold yet. It is listed here so nothing is lost."
	messageUnsafePath    = "%q is not a safe path inside the collection"
	messageDepth         = "Folders nested deeper than %d levels were skipped."
	messageDocumentRead  = "could not read the document: %v"
)
