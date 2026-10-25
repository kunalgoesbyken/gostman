package importer

const (
	messageExportTarget        = "scripts cannot be adapted for %q; choose postman or bruno"
	messageExportMissing       = "%s has no %s equivalent: %s."
	messageExportUnknown       = "%s has no %s equivalent and is kept as written."
	messageExportMatchSchema   = "matchSchema is Gostman's name for this check. Write .jsonSchema(schema), which Postman and Gostman both run."
	messageExportBrunoSchema   = "Bruno's expect has no JSON Schema check. Validate with require(\"ajv\") instead."
	messageExportRunRequest    = "sendRequest(%q) names no request in this collection, so bru.runRequest will not find it"
	messageExportSavedRequest  = "sendRequest(%q) sends a saved request by name, but Postman's sendRequest takes an address, so this call will fail there."
	messageExportUnread        = "the script could not be read, so it is exported as written"
	messageExportCheckOperator = "%q is not a check"
	messageExportCheckPath     = "%s cannot be written as %s code; use a path such as res.body.items[0].id"
	messageExportCheckLeft     = "the check %q was left out, because %s"
	messageExportLine          = "In %s, %s, line %d: %s"
	messageExportPlace         = "In %s, %s: %s."
	messageExportForeign       = "%[1]s.* belongs to another tool's script API, which %[2]s does not run. Rewrite these calls with %[2]s's API."
	messageExportExtractLeft   = "the extract rule %q was left out, because %s cannot be written as %s code; use a plain path such as $.data.token, or set the value in the post-response script"

	reasonDates               = "format dates with require(\"moment\") instead"
	reasonQueries             = "res(query) lookups are Gostman's own, so read the body with pm.response.json() instead"
	reasonPostmanFinalURL     = "Postman does not give the address of the final response"
	reasonPostmanResponseBody = "Postman scripts cannot change the response body"
	reasonPostmanTimeout      = "Postman scripts cannot read or change a request's timeout"
	reasonBrunoCollectionList = "Bruno cannot list collection variables"
	reasonBrunoVisualize      = "bru.visualize takes finished HTML or a table definition, not a template"
	reasonBrunoSize           = "Bruno's res has no size; read res.getSize().body instead"
	reasonBrunoURL            = "Bruno's res.url is built from the request, not the address of the final response"
	reasonBrunoStatusText     = "Bruno's res.statusText holds only the reason, such as OK, where Gostman's starts with the code, such as 200 OK"
)

var (
	messageExportRewritten      = countedText{"%d script that called %s was rewritten with %s's API.", "%d scripts that called %s were rewritten with %s's API."}
	messageExportUnchanged      = countedText{"%d script needs no change for %s and is exported as written.", "%d scripts need no change for %s and are exported as written."}
	messageExportAdapted        = countedText{"%d script got a few lines at the top that define %s with %s's API, so the rest runs as written.", "%d scripts got a few lines at the top that define %s with %s's API, so the rest runs as written."}
	messageExportChecks         = countedText{"%d assertion row became a %s test.", "%d assertion rows became %s tests."}
	messageExportKept           = countedText{"%d assertion row exported as a Bruno assertion.", "%d assertion rows exported as Bruno assertions."}
	messageExportSkipped        = countedText{"%d assertion row turned off in Gostman was left out.", "%d assertion rows turned off in Gostman were left out."}
	messageExportSkippedTests   = countedText{"%d assertion row turned off in Gostman became a skipped %s test.", "%d assertion rows turned off in Gostman became skipped %s tests."}
	messageExportExtractLines   = countedText{"%d extract rule became a line at the top of a post-response script.", "%d extract rules became lines at the top of post-response scripts."}
	messageExportExtractVars    = countedText{"%d extract rule became a Bruno post-response var.", "%d extract rules became Bruno post-response vars."}
	messageExportExtractSkipped = countedText{"%d extract rule turned off in Gostman was left out.", "%d extract rules turned off in Gostman were left out."}
	messageExportBrunoOrder     = countedText{"Bruno lists folders before requests, so %[2]s will run after the folders beside it in Bruno.", "Bruno lists folders before requests, so %[2]s will run after the folders beside them in Bruno."}
)
