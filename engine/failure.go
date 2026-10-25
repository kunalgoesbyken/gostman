package engine

import (
	"crypto/x509"
	"errors"
	"net"
	"net/url"

	"github.com/kunalgoesbyken/gostman/locales"
)

func networkFailure(err error) Response {
	hint := networkHint(err)
	if hint == nil {
		return Failure(ErrorNetwork, err.Error())
	}
	return Failed(ErrorNetwork, hint.WithDetail(err.Error()))
}

func networkHint(err error) *locales.Message {
	var lookup *net.DNSError
	var authority x509.UnknownAuthorityError
	var hostname x509.HostnameError
	var invalid x509.CertificateInvalidError
	var dial *net.OpError
	advice, hasCertificate := adviceFor(err)
	switch {
	case errors.As(err, &lookup):
		return hint(locales.EngineNetworkHostNotFound, locales.Params{"host": lookup.Name})
	case errors.As(err, &authority):
		return hint(locales.EngineNetworkUntrustedAuthority, locales.Params{"advice": adviceText(advice.UntrustedAuthority, AppAdvice.UntrustedAuthority, locales.EngineAdviceUntrustedAuthority)})
	case refusedHandshake(err) && hasCertificate:
		return hint(locales.EngineNetworkHandshakeCertificate, nil)
	case refusedHandshake(err):
		return hint(locales.EngineNetworkHandshake, locales.Params{"advice": adviceText(advice.ClientCertificate, AppAdvice.ClientCertificate, locales.EngineAdviceClientCertificate)})
	case errors.As(err, &hostname):
		return hint(locales.EngineNetworkHostMismatch, locales.Params{"host": hostname.Host})
	case errors.As(err, &invalid) && invalid.Reason == x509.Expired:
		return hint(locales.EngineNetworkCertificateExpired, nil)
	case errors.As(err, &dial) && dial.Op == "proxyconnect":
		return proxyHint(err)
	case errors.As(err, &dial) && dial.Op == "dial":
		return dialHint(err, dial)
	}
	return nil
}

func hint(code locales.Code, params locales.Params) *locales.Message {
	message := locales.New(code, params)
	return &message
}

func adviceText(text, appText string, code locales.Code) any {
	if text == appText {
		return locales.New(code, nil)
	}
	return text
}

func proxyHint(err error) *locales.Message {
	var configured *proxySourceError
	if errors.As(err, &configured) {
		return hint(locales.EngineNetworkProxyConnect, locales.Params{"source": configured.source})
	}
	return hint(locales.EngineNetworkProxyConnectSettings, nil)
}

func dialHint(err error, dial *net.OpError) *locales.Message {
	if host, known := requestHost(err, dial); known {
		return hint(locales.EngineNetworkDial, locales.Params{"host": host})
	}
	return hint(locales.EngineNetworkDialServer, nil)
}

func requestHost(err error, dial *net.OpError) (string, bool) {
	var request *url.Error
	if errors.As(err, &request) {
		if address, parseErr := url.Parse(request.URL); parseErr == nil && address.Host != "" {
			return address.Host, true
		}
	}
	if dial.Addr != nil {
		return dial.Addr.String(), true
	}
	return "", false
}
