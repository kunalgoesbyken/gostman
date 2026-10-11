package engine

import (
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"time"
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

func newJar(stored []CookieInfo, now time.Time) http.CookieJar {
	jar, _ := cookiejar.New(nil)
	for _, info := range stored {
		if origin, cookie, ok := restoreCookie(info, now); ok {
			jar.SetCookies(origin, []*http.Cookie{cookie})
		}
	}
	return jar
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
	if strings.Contains(host, ":") {
		host = "[" + host + "]"
	}
	return &url.URL{Scheme: "https", Host: host, Path: cookie.Path}, cookie, true
}
