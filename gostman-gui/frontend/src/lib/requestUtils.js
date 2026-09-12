import { substitute } from "./variables"

/**
 * Prepares the request data for fetching.
 * Handles GraphQL conversion, variable substitution, header parsing,
 * and URL construction with query params (overwrite semantics).
 *
 * Mirrors the desktop Go backend (app.go SendRequest) so web and
 * desktop behave identically.
 */
export function prepareRequest(activeRequest, variablesMap) {
    // Normalize method (uppercase + trim) — matches app.go:334
    let method = (activeRequest.method || "").trim().toUpperCase()

    let bodyStr = activeRequest.body || ""
    let headersStr = activeRequest.headers || "{}"
    let paramsStr = activeRequest.queryParams || "{}"
    let urlStr = activeRequest.url || ""

    // GraphQL handling — matches app.go:236-287
    if (method === "GRAPHQL") {
        method = "POST"

        // Dedicated GraphQL tab fields win when present, else fall back to
        // body/queryParams so saved requests and Postman imports keep working
        // — matches app.go:245-252
        const queryStr =
            typeof activeRequest.graphqlQuery === "string" &&
            activeRequest.graphqlQuery.trim() !== ""
                ? activeRequest.graphqlQuery
                : bodyStr
        const varsStr =
            typeof activeRequest.graphqlVariables === "string" &&
            activeRequest.graphqlVariables.trim() !== ""
                ? activeRequest.graphqlVariables
                : paramsStr

        const graphqlReq = { query: queryStr }
        // Parse variables as the GraphQL variables object; omit on failure
        try {
            graphqlReq.variables = JSON.parse(varsStr)
        } catch (e) {
            // omit variables
        }
        bodyStr = JSON.stringify(graphqlReq)

        // Default Content-Type: application/json if not already set (case-insensitive)
        try {
            const headers = JSON.parse(headersStr || "{}")
            const hasContentType = Object.keys(headers).some(
                (k) => k.toLowerCase() === "content-type"
            )
            if (!hasContentType) {
                headers["Content-Type"] = "application/json"
            }
            headersStr = JSON.stringify(headers)
        } catch (e) {
            console.error("Failed to parse headers for GraphQL", e)
        }
    }

    // Variable substitution — matches app.go:298-302
    urlStr = substitute(urlStr, variablesMap)
    headersStr = substitute(headersStr, variablesMap)
    paramsStr = substitute(paramsStr, variablesMap)
    bodyStr = substitute(bodyStr, variablesMap)

    // Default scheme to https if missing — matches app.go:328-331 ("4b").
    // app.go can run this after query-param assembly because url.Parse tolerates
    // scheme-less input; the WHATWG `new URL()` below does not, so it must run
    // first here. Net result is identical.
    if (urlStr !== "" && !urlStr.includes("://")) {
        urlStr = "https://" + urlStr
    }

    let headersObj = {}
    try {
        headersObj = JSON.parse(headersStr || "{}")
    } catch (e) {
        throw new Error("Invalid headers format: " + e.message)
    }

    // Query params: overwrite existing URL keys (no duplicates, single
    // string values, sorted) — matches app.go:310-326 (url.Values.Set + Encode)
    let fetchUrl = urlStr
    try {
        const queryObj = JSON.parse(paramsStr || "{}")
        if (Object.keys(queryObj).length > 0) {
            const u = new URL(fetchUrl)
            const sp = u.searchParams
            for (const [key, value] of Object.entries(queryObj)) {
                sp.set(key, String(value))
            }
            sp.sort()
            u.search = sp.toString()
            fetchUrl = u.toString()
        }
    } catch (e) {
        console.error("Failed to parse query params", e)
    }

    // Body attachment for any method when non-empty — matches app.go:343-348
    return {
        url: fetchUrl,
        method,
        headers: headersObj,
        body: bodyStr !== "" ? bodyStr : undefined,
    }
}
