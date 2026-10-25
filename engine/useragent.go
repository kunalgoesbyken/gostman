package engine

import "net/http"

const (
	headerUserAgent = "User-Agent"
	productName     = "Gostman"
)

var ProductVersion = ""

func defaultUserAgent() string {
	if ProductVersion == "" {
		return productName
	}
	return productName + "/" + ProductVersion
}

func withDefaultUserAgent(header http.Header) {
	if _, set := header[headerUserAgent]; !set {
		header.Set(headerUserAgent, defaultUserAgent())
	}
}
