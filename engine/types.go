package engine

type Auth struct {
	Type     string `json:"type"`
	Username string `json:"username"`
	Password string `json:"password"`
	Token    string `json:"token"`
	Key      string `json:"key"`
	Value    string `json:"value"`
	In       string `json:"in"`
}

type Options struct {
	TimeoutMs         int  `json:"timeoutMs"`
	NoFollowRedirects bool `json:"noFollowRedirects"`
	InsecureTLS       bool `json:"insecureTLS"`
}

type Request struct {
	Method           string  `json:"method"`
	URL              string  `json:"url"`
	Headers          string  `json:"headers"`
	QueryParams      string  `json:"queryParams"`
	Body             string  `json:"body"`
	BodyType         string  `json:"bodyType"`
	GraphqlQuery     string  `json:"graphqlQuery"`
	GraphqlVariables string  `json:"graphqlVariables"`
	Auth             Auth    `json:"auth"`
	Variables        string  `json:"variables"`
	Options          Options `json:"options"`
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
}

type Prepared struct {
	Method  string        `json:"method"`
	URL     string        `json:"url"`
	Headers []HeaderEntry `json:"headers"`
	Body    string        `json:"body"`

	body []byte
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
}
