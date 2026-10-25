package engine

type Auth struct {
	Type     string `json:"type"`
	Username string `json:"username"`
	Password string `json:"password"`
	Token    string `json:"token"`
	Key      string `json:"key"`
	Value    string `json:"value"`
	In       string `json:"in"`
	OAuth2   OAuth2 `json:"oauth2"`

	Domain   string       `json:"domain"`
	AWS      AWSAuth      `json:"aws"`
	OAuth1   OAuth1Auth   `json:"oauth1"`
	EdgeGrid EdgeGridAuth `json:"edgegrid"`
	JWT      JWTAuth      `json:"jwt"`
	ASAP     ASAPAuth     `json:"asap"`
	Hawk     HawkAuth     `json:"hawk"`
}

type OAuth2 struct {
	Grant            string `json:"grant"`
	AuthURL          string `json:"authUrl"`
	TokenURL         string `json:"tokenUrl"`
	ClientID         string `json:"clientId"`
	ClientSecret     string `json:"clientSecret"`
	Scope            string `json:"scope"`
	Username         string `json:"username"`
	Password         string `json:"password"`
	CallbackURL      string `json:"callbackUrl"`
	CredentialsIn    string `json:"credentialsIn"`
	PKCE             bool   `json:"pkce"`
	HeaderPrefix     string `json:"headerPrefix"`
	AccessToken      string `json:"accessToken"`
	RefreshToken     string `json:"refreshToken"`
	ExpiresAt        int64  `json:"expiresAt"`
	Resource         string `json:"resource"`
	Issuer           string `json:"issuer"`
	DeviceURL        string `json:"deviceUrl"`
	SendIDToken      bool   `json:"sendIdToken"`
	IDToken          string `json:"idToken"`
	TokenEnvironment string `json:"tokenEnvironment"`
}

type Options struct {
	TimeoutMs         int  `json:"timeoutMs"`
	NoFollowRedirects bool `json:"noFollowRedirects"`
	InsecureTLS       bool `json:"insecureTLS"`

	Stream           bool `json:"stream"`
	StreamReconnect  bool `json:"streamReconnect"`
	StreamMaxEvents  int  `json:"streamMaxEvents"`
	StreamMaxSeconds int  `json:"streamMaxSeconds"`

	SkipCookies    bool `json:"skipCookies"`
	DiscardCookies bool `json:"discardCookies"`

	SocketIOPath string `json:"socketIoPath"`
	SocketIOAuth string `json:"socketIoAuth"`
}

type Request struct {
	Method           string       `json:"method"`
	URL              string       `json:"url"`
	Headers          string       `json:"headers"`
	QueryParams      string       `json:"queryParams"`
	Body             string       `json:"body"`
	BodyType         string       `json:"bodyType"`
	GraphqlQuery     string       `json:"graphqlQuery"`
	GraphqlVariables string       `json:"graphqlVariables"`
	Auth             Auth         `json:"auth"`
	Variables        string       `json:"variables"`
	Options          Options      `json:"options"`
	Cookies          []CookieInfo `json:"cookies"`
	Inherited        []Layer      `json:"inherited,omitempty"`
}

type HeaderEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CookieInfo struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Domain   string `json:"domain"`
	Path     string `json:"path"`
	Expires  string `json:"expires"`
	Secure   bool   `json:"secure"`
	HttpOnly bool   `json:"httpOnly"`
	HostOnly bool   `json:"hostOnly"`
	Expired  bool   `json:"expired"`
}

type PreparedPart struct {
	Name        string `json:"name"`
	Value       string `json:"value,omitempty"`
	File        string `json:"file,omitempty"`
	ContentType string `json:"contentType,omitempty"`
}

type Prepared struct {
	Method     string         `json:"method"`
	URL        string         `json:"url"`
	Headers    []HeaderEntry  `json:"headers"`
	Body       string         `json:"body"`
	Parts      []PreparedPart `json:"parts,omitempty"`
	File       string         `json:"file,omitempty"`
	Unresolved []string       `json:"unresolved,omitempty"`

	body   []byte
	stream *bodyStream
}

const (
	EncodingUTF8   = "utf8"
	EncodingBase64 = "base64"
)

const (
	ErrorConfig    = "config"
	ErrorNetwork   = "network"
	ErrorTimeout   = "timeout"
	ErrorCancelled = "cancelled"
	ErrorBlocked   = "blocked"
)

type Response struct {
	Status       string        `json:"status"`
	StatusCode   int           `json:"statusCode"`
	Headers      []HeaderEntry `json:"headers"`
	Cookies      []CookieInfo  `json:"cookies"`
	Body         string        `json:"body"`
	BodyEncoding string        `json:"bodyEncoding"`
	ContentType  string        `json:"contentType"`
	Size         int64         `json:"size"`
	DurationMs   int64         `json:"durationMs"`
	URL          string        `json:"url"`
	Truncated    bool          `json:"truncated"`
	Error        string        `json:"error"`
	Protocol     string        `json:"protocol,omitempty"`
	StreamEnd    string        `json:"streamEnd,omitempty"`
	Timeline     *Timeline     `json:"timeline,omitempty"`

	Failed        bool           `json:"failed,omitempty"`
	Notifications []Notification `json:"notifications,omitempty"`
	Unresolved    []string       `json:"unresolved,omitempty"`
}

type Notification struct {
	Method string `json:"method"`
	Params string `json:"params,omitempty"`
	AtMs   int64  `json:"atMs"`
}
