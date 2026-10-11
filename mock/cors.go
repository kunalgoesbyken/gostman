package mock

import "net/http"

const (
	headerOrigin           = "Origin"
	headerRequestMethod    = "Access-Control-Request-Method"
	headerRequestHeaders   = "Access-Control-Request-Headers"
	headerAllowOrigin      = "Access-Control-Allow-Origin"
	headerAllowCredentials = "Access-Control-Allow-Credentials"
	headerAllowMethods     = "Access-Control-Allow-Methods"
	headerAllowHeaders     = "Access-Control-Allow-Headers"
	headerMaxAge           = "Access-Control-Max-Age"
	headerVary             = "Vary"
	anyOrigin              = "*"
	preflightMaxAgeSeconds = "600"
)

func isPreflight(r *http.Request) bool {
	return r.Method == http.MethodOptions && r.Header.Get(headerRequestMethod) != ""
}

func preflightAnswer(r *http.Request) answer {
	headers := []Header{
		{Key: headerAllowMethods, Value: r.Header.Get(headerRequestMethod)},
		{Key: headerMaxAge, Value: preflightMaxAgeSeconds},
	}
	if requested := r.Header.Get(headerRequestHeaders); requested != "" {
		headers = append(headers, Header{Key: headerAllowHeaders, Value: requested})
	}
	return answer{status: http.StatusNoContent, headers: headers}
}

func allowOrigin(header http.Header, r *http.Request) {
	origin := r.Header.Get(headerOrigin)
	if origin == "" {
		header.Set(headerAllowOrigin, anyOrigin)
		header.Del(headerAllowCredentials)
		return
	}
	header.Set(headerAllowOrigin, origin)
	header.Set(headerAllowCredentials, "true")
	header.Add(headerVary, headerOrigin)
}
