package engine

import (
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/net/publicsuffix"
)

const cookieTimeLayout = time.RFC1123

type cookieLog struct {
	now     time.Time
	entries []CookieInfo
}

func (l *cookieLog) record(response *http.Response) {
	host := response.Request.URL.Hostname()
	for _, cookie := range response.Cookies() {
		l.entries = append(l.entries, describeCookie(cookie, host, l.now))
	}
}

func describeCookie(cookie *http.Cookie, host string, now time.Time) CookieInfo {
	expiry := cookie.Expires
	if cookie.MaxAge > 0 {
		expiry = now.Add(time.Duration(cookie.MaxAge) * time.Second)
	}
	info := CookieInfo{
		Name:     cookie.Name,
		Value:    cookie.Value,
		Domain:   strings.TrimPrefix(cookie.Domain, "."),
		Path:     cookie.Path,
		Secure:   cookie.Secure,
		HttpOnly: cookie.HttpOnly,
		HostOnly: cookie.Domain == "",
		Expired:  cookie.MaxAge < 0 || (!expiry.IsZero() && expiry.Before(now)),
	}
	if info.HostOnly {
		info.Domain = host
	}
	if !expiry.IsZero() {
		info.Expires = expiry.UTC().Format(cookieTimeLayout)
	}
	return info
}

func sentCookies(r Request) []CookieInfo {
	if r.Options.SkipCookies {
		return nil
	}
	return r.Cookies
}

func newJar(stored []CookieInfo, now time.Time) http.CookieJar {
	jar, _ := cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})
	if len(stored) == 0 {
		return jar
	}
	lazy := &lazyJar{jar: jar, now: now, stored: stored, keys: make([]string, len(stored)), seeded: make(map[string]bool)}
	var lastHost, lastKey string
	for i, info := range stored {
		host := restoredHost(info)
		if i == 0 || host != lastHost {
			key, indexable := jarKey(host)
			if !indexable {
				lazy.seedUnseeded()
				return jar
			}
			lastHost, lastKey = host, key
		}
		lazy.keys[i] = lastKey
	}
	return lazy
}

type lazyJar struct {
	mu     sync.Mutex
	jar    *cookiejar.Jar
	now    time.Time
	stored []CookieInfo
	keys   []string
	seeded map[string]bool
	all    bool
}

func (j *lazyJar) SetCookies(u *url.URL, cookies []*http.Cookie) {
	j.seedFor(u)
	j.jar.SetCookies(u, cookies)
}

func (j *lazyJar) Cookies(u *url.URL) []*http.Cookie {
	j.seedFor(u)
	return j.jar.Cookies(u)
}

func (j *lazyJar) seedFor(u *url.URL) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.all {
		return
	}
	key, indexable := jarKey(u.Host)
	if !indexable {
		j.seedUnseeded()
		return
	}
	if j.seeded[key] {
		return
	}
	j.seeded[key] = true
	for i, info := range j.stored {
		if j.keys[i] == key {
			j.seed(info)
		}
	}
}

func (j *lazyJar) seedUnseeded() {
	for i, info := range j.stored {
		if !j.seeded[j.keys[i]] {
			j.seed(info)
		}
	}
	j.all = true
}

func (j *lazyJar) seed(info CookieInfo) {
	if origin, cookie, ok := restoreCookie(info, j.now); ok {
		j.jar.SetCookies(origin, []*http.Cookie{cookie})
	}
}
func jarKey(hostPort string) (string, bool) {
	host := hostPort
	if strings.LastIndex(host, ":") > strings.LastIndex(host, "]") {
		var err error
		if host, _, err = net.SplitHostPort(host); err != nil {
			return "", false
		}
	}
	host = strings.TrimSuffix(host, ".")
	for i := 0; i < len(host); i++ {
		if host[i] >= utf8.RuneSelf {
			return "", false
		}
	}
	host = strings.ToLower(host)
	if strings.ContainsAny(host, ":%") || endsWithDigit(host) && net.ParseIP(host) != nil {
		return host, true
	}
	suffix := publicsuffix.List.PublicSuffix(host)
	if suffix == host {
		return host, true
	}
	cut := len(host) - len(suffix)
	if cut <= 0 || host[cut-1] != '.' {
		return host, true
	}
	return host[strings.LastIndex(host[:cut-1], ".")+1:], true
}

func endsWithDigit(host string) bool {
	return host != "" && host[len(host)-1] >= '0' && host[len(host)-1] <= '9'
}

func restoredHost(info CookieInfo) string {
	host := strings.TrimPrefix(info.Domain, ".")
	if strings.Contains(host, ":") {
		return "[" + host + "]"
	}
	return host
}

func restoreCookie(info CookieInfo, now time.Time) (*url.URL, *http.Cookie, bool) {
	host := strings.TrimPrefix(info.Domain, ".")
	if host == "" || info.Name == "" || info.Expired {
		return nil, nil, false
	}
	cookie := &http.Cookie{Name: info.Name, Value: info.Value, Path: info.Path, Secure: info.Secure, HttpOnly: info.HttpOnly}
	if cookie.Path == "" {
		cookie.Path = "/"
	}
	if !info.HostOnly {
		cookie.Domain = host
	}
	if expiry, err := time.Parse(cookieTimeLayout, info.Expires); err == nil {
		if expiry.Before(now) {
			return nil, nil, false
		}
		cookie.Expires = expiry
	}
	return &url.URL{Scheme: "https", Host: restoredHost(info), Path: cookie.Path}, cookie, true
}
