package lint

import (
	"net"
	"net/url"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
)

func infoRules() []Rule {
	return []Rule{
		{ID: "info-title", Severity: SeverityError, Description: "info.title is present", Check: infoField("title")},
		{ID: "info-version", Severity: SeverityError, Description: "info.version is present", Check: infoField("version")},
		{ID: "info-description", Severity: SeverityInfo, Description: "info.description is present", Check: infoField("description")},
		{ID: "servers-defined", Severity: SeverityWarning, Description: "the document says where the API is served", Check: serversDefined},
		{ID: "servers-https", Severity: SeverityWarning, Description: "servers use https, except localhost", Check: serversHTTPS},
	}
}

func infoField(name string) func(*Spec) []Issue {
	return func(s *Spec) []Issue {
		if !blank(asMap(s.Root["info"])[name]) {
			return nil
		}
		return []Issue{issueAt(pointer("info", name), locales.LintInfoFieldMissing, locales.Params{"field": name})}
	}
}

func serversDefined(s *Spec) []Issue {
	if s.V2 {
		return hostDefined(s)
	}
	if len(asList(s.Root["servers"])) > 0 {
		return nil
	}
	return []Issue{issueAt("/servers", locales.LintInfoNoServers, nil)}
}

func hostDefined(s *Spec) []Issue {
	if !blank(s.Root["host"]) {
		return nil
	}
	return []Issue{issueAt("/host", locales.LintInfoNoHost, nil)}
}

func serversHTTPS(s *Spec) []Issue {
	if s.V2 {
		return schemesHTTPS(s)
	}
	var issues []Issue
	for index, raw := range asList(s.Root["servers"]) {
		address := asString(asMap(raw)["url"])
		if insecureAddress(address) {
			issues = append(issues, issueAt(pointer("servers", strconv.Itoa(index), "url"), locales.LintInfoServerNotHttps, locales.Params{"url": address}))
		}
	}
	return issues
}

func schemesHTTPS(s *Spec) []Issue {
	offers := map[string]bool{}
	for _, scheme := range asList(s.Root["schemes"]) {
		offers[asString(scheme)] = true
	}
	if !offers["http"] || offers["https"] || loopbackHost(hostOf(asString(s.Root["host"]))) {
		return nil
	}
	return []Issue{issueAt("/schemes", locales.LintInfoHttpOnly, nil)}
}

func hostOf(authority string) string {
	parsed, err := url.Parse("//" + authority)
	if err != nil {
		return authority
	}
	return parsed.Hostname()
}

func insecureAddress(address string) bool {
	parsed, err := url.Parse(address)
	if err != nil || parsed.Scheme != "http" {
		return false
	}
	return !loopbackHost(parsed.Hostname())
}

func loopbackHost(host string) bool {
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
