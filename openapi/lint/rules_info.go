package lint

import (
	"net"
	"net/url"
	"strconv"
	"strings"
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
		return []Issue{{Path: pointer("info", name), Message: "info." + name + " is missing or empty"}}
	}
}

func serversDefined(s *Spec) []Issue {
	if s.V2 {
		return hostDefined(s)
	}
	if len(asList(s.Root["servers"])) > 0 {
		return nil
	}
	return []Issue{{Path: "/servers", Message: "no servers are listed, so clients cannot tell where the API is served"}}
}

func hostDefined(s *Spec) []Issue {
	if !blank(s.Root["host"]) {
		return nil
	}
	return []Issue{{Path: "/host", Message: "no host is set, so clients cannot tell where the API is served"}}
}

func serversHTTPS(s *Spec) []Issue {
	if s.V2 {
		return schemesHTTPS(s)
	}
	var issues []Issue
	for index, raw := range asList(s.Root["servers"]) {
		address := asString(asMap(raw)["url"])
		if insecureAddress(address) {
			issues = append(issues, Issue{Path: pointer("servers", strconv.Itoa(index), "url"), Message: address + " does not use https"})
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
	return []Issue{{Path: "/schemes", Message: "the API is offered over http only"}}
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
