package engine

import (
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"net/url"
)

func networkFailure(err error) Response {
	hint := networkHint(err)
	if hint == "" {
		return Failure(ErrorNetwork, err.Error())
	}
	return Failure(ErrorNetwork, hint+"\n\n"+err.Error())
}

func networkHint(err error) string {
	var lookup *net.DNSError
	var authority x509.UnknownAuthorityError
	var hostname x509.HostnameError
	var invalid x509.CertificateInvalidError
	var dial *net.OpError
	switch {
	case errors.As(err, &lookup):
		return fmt.Sprintf("The host %s could not be found. Check the address for typos and that this computer is online.", lookup.Name)
	case errors.As(err, &authority):
		return "The server's certificate is not signed by an authority this computer trusts. Trust its certificate authority, or turn off certificate verification for this request."
	case errors.As(err, &hostname):
		return fmt.Sprintf("The server's certificate is not valid for %s. Check that the address is the one the certificate was issued for.", hostname.Host)
	case errors.As(err, &invalid) && invalid.Reason == x509.Expired:
		return "The server's certificate has expired or is not valid yet. Check the clock on this computer, or renew the certificate."
	case errors.As(err, &dial) && dial.Op == "proxyconnect":
		return "Could not connect to the proxy server. Check the proxy address in the network settings."
	case errors.As(err, &dial) && dial.Op == "dial":
		return fmt.Sprintf("Could not connect to %s. Check that the server is running and that the host and port are right.", requestHost(err, dial))
	}
	return ""
}

func requestHost(err error, dial *net.OpError) string {
	var request *url.Error
	if errors.As(err, &request) {
		if address, parseErr := url.Parse(request.URL); parseErr == nil && address.Host != "" {
			return address.Host
		}
	}
	if dial.Addr != nil {
		return dial.Addr.String()
	}
	return "the server"
}
