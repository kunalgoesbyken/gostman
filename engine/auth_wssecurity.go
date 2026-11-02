package engine

import (
	"bytes"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
	"time"
)

const (
	authWSSecurity = "wssecurity"

	wssePasswordText   = "text"
	wssePasswordDigest = "digest"

	wsseNamespace     = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
	wsuNamespace      = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"
	wsseProfile       = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0"
	wsseNonceBytes    = 16
	wsseLabel         = "WS-Security"
	wsseCreatedLayout = "2006-01-02T15:04:05Z"
	soapEnvelopeName  = "Envelope"
	soapHeaderName    = "Header"
)

type WSSecurityAuth struct {
	Username     string `json:"username"`
	Password     string `json:"password"`
	PasswordType string `json:"passwordType"`
	Timestamp    string `json:"timestamp"`
}

type securityHeader struct {
	username     string
	password     string
	passwordType string
	lifetime     time.Duration
	now          time.Time
	nonce        []byte
	soapNS       string
}

func applyWSSecurity(auth Auth, substitute func(string) string, body []byte) ([]byte, error) {
	header, err := newSecurityHeader(auth, substitute)
	if err != nil {
		return body, fmt.Errorf("%s: %w", wsseLabel, err)
	}
	patched, err := insertSecurity(body, header)
	if err != nil {
		return body, fmt.Errorf("%s: %w", wsseLabel, err)
	}
	return patched, nil
}

func newSecurityHeader(auth Auth, substitute func(string) string) (securityHeader, error) {
	header := securityHeader{
		username:     substitute(auth.WSSecurity.Username),
		password:     substitute(auth.WSSecurity.Password),
		passwordType: strings.ToLower(strings.TrimSpace(substitute(auth.WSSecurity.PasswordType))),
		now:          clock().UTC(),
	}
	if header.passwordType == "" {
		header.passwordType = wssePasswordText
	}
	if header.passwordType != wssePasswordText && header.passwordType != wssePasswordDigest {
		return header, fmt.Errorf("the password type %q is not supported; use %q or %q", header.passwordType, wssePasswordText, wssePasswordDigest)
	}
	if text := strings.TrimSpace(substitute(auth.WSSecurity.Timestamp)); text != "" {
		lifetime, err := asapLifetime(text)
		if err != nil {
			return header, err
		}
		header.lifetime = lifetime
	}
	if header.username == "" && header.lifetime == 0 {
		return header, fmt.Errorf("give a username, a timestamp lifetime or both")
	}
	header.nonce = make([]byte, wsseNonceBytes)
	if _, err := rand.Read(header.nonce); err != nil {
		return header, err
	}
	return header, nil
}

func (h securityHeader) created() string {
	return h.now.Format(wsseCreatedLayout)
}

func (h securityHeader) digest() string {
	sum := sha1.Sum(append(append(append([]byte{}, h.nonce...), h.created()...), h.password...))
	return base64.StdEncoding.EncodeToString(sum[:])
}

func escaped(text string) string {
	var out bytes.Buffer
	_ = xml.EscapeText(&out, []byte(text))
	return out.String()
}

func (h securityHeader) xml() string {
	var out strings.Builder
	fmt.Fprintf(&out, `<wsse:Security xmlns:wsse="%s" xmlns:wsu="%s" xmlns:wssoap="%s" wssoap:mustUnderstand="1">`, wsseNamespace, wsuNamespace, h.soapNS)
	if h.lifetime > 0 {
		fmt.Fprintf(&out, `<wsu:Timestamp wsu:Id="TS-1"><wsu:Created>%s</wsu:Created><wsu:Expires>%s</wsu:Expires></wsu:Timestamp>`,
			h.created(), h.now.Add(h.lifetime).Format(wsseCreatedLayout))
	}
	if h.username != "" {
		h.writeUsernameToken(&out)
	}
	out.WriteString(`</wsse:Security>`)
	return out.String()
}

func (h securityHeader) writeUsernameToken(out *strings.Builder) {
	fmt.Fprintf(out, `<wsse:UsernameToken wsu:Id="UsernameToken-1"><wsse:Username>%s</wsse:Username>`, escaped(h.username))
	if h.passwordType == wssePasswordDigest {
		fmt.Fprintf(out, `<wsse:Password Type="%s#PasswordDigest">%s</wsse:Password>`, wsseProfile, h.digest())
		fmt.Fprintf(out, `<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">%s</wsse:Nonce>`, base64.StdEncoding.EncodeToString(h.nonce))
		fmt.Fprintf(out, `<wsu:Created>%s</wsu:Created>`, h.created())
	} else {
		fmt.Fprintf(out, `<wsse:Password Type="%s#PasswordText">%s</wsse:Password>`, wsseProfile, escaped(h.password))
	}
	out.WriteString(`</wsse:UsernameToken>`)
}

type envelopeShape struct {
	prefix       string
	namespace    string
	afterStart   int
	headerAfter  int
	headerClosed bool
	headerName   string
}

func qualified(prefix, local string) string {
	if prefix == "" {
		return local
	}
	return prefix + ":" + local
}

func scanEnvelope(body []byte) (envelopeShape, error) {
	decoder := xml.NewDecoder(bytes.NewReader(body))
	var shape envelopeShape
	depth := 0
	for {
		token, err := decoder.RawToken()
		if err == io.EOF {
			break
		}
		if err != nil {
			return shape, fmt.Errorf("the body is not well-formed XML: %w", err)
		}
		switch element := token.(type) {
		case xml.StartElement:
			depth++
			after := int(decoder.InputOffset())
			if depth == 1 && element.Name.Local == soapEnvelopeName {
				shape.prefix, shape.afterStart = element.Name.Space, after
				shape.namespace = declaredNamespace(element)
			}
			if depth == 2 && element.Name.Local == soapHeaderName && shape.headerAfter == 0 {
				shape.headerAfter, shape.headerName = after, qualified(element.Name.Space, soapHeaderName)
				shape.headerClosed = bytes.HasSuffix(body[:after], []byte("/>"))
			}
		case xml.EndElement:
			depth--
		}
	}
	if shape.afterStart == 0 {
		return shape, fmt.Errorf("the body has no SOAP Envelope; use the SOAP body type")
	}
	return shape, nil
}

func declaredNamespace(envelope xml.StartElement) string {
	for _, attribute := range envelope.Attr {
		isDefault := envelope.Name.Space == "" && attribute.Name.Space == "" && attribute.Name.Local == "xmlns"
		isPrefixed := attribute.Name.Space == "xmlns" && attribute.Name.Local == envelope.Name.Space
		if isDefault || isPrefixed {
			return attribute.Value
		}
	}
	return ""
}

func insertSecurity(body []byte, header securityHeader) ([]byte, error) {
	shape, err := scanEnvelope(body)
	if err != nil {
		return body, err
	}
	header.soapNS = shape.namespace
	fragment := header.xml()
	switch {
	case shape.headerAfter == 0:
		name := qualified(shape.prefix, soapHeaderName)
		return splice(body, shape.afterStart, shape.afterStart, "<"+name+">"+fragment+"</"+name+">"), nil
	case shape.headerClosed:
		return splice(body, shape.headerAfter-2, shape.headerAfter, ">"+fragment+"</"+shape.headerName+">"), nil
	}
	return splice(body, shape.headerAfter, shape.headerAfter, fragment), nil
}

func splice(body []byte, from, to int, insertion string) []byte {
	out := make([]byte, 0, len(body)+len(insertion))
	out = append(out, body[:from]...)
	out = append(out, insertion...)
	return append(out, body[to:]...)
}
