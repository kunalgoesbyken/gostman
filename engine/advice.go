package engine

import (
	"errors"
	"net"
)

const opRemoteError = "remote error"

type Advice struct {
	UntrustedAuthority string
	ClientCertificate  string
}

var AppAdvice = Advice{
	UntrustedAuthority: "Trust its certificate authority, or turn off certificate verification for this request.",
	ClientCertificate:  "If the server requires a client certificate, add one for this host in the desktop app's network settings.",
}

func (a Advice) orDefault() Advice {
	if a.UntrustedAuthority == "" {
		a.UntrustedAuthority = AppAdvice.UntrustedAuthority
	}
	if a.ClientCertificate == "" {
		a.ClientCertificate = AppAdvice.ClientCertificate
	}
	return a
}

type advisedError struct {
	advice         Advice
	hasCertificate bool
	err            error
}

func (e *advisedError) Error() string {
	return e.err.Error()
}

func (e *advisedError) Unwrap() error {
	return e.err
}

func (p Policy) Advised(host string, err error) error {
	if err == nil {
		return nil
	}
	network := p.network()
	return &advisedError{advice: network.advice, hasCertificate: network.certificateFor(host) != noCertificate, err: err}
}

func adviceFor(err error) (Advice, bool) {
	var advised *advisedError
	if errors.As(err, &advised) {
		return advised.advice.orDefault(), advised.hasCertificate
	}
	return AppAdvice, false
}

func refusedHandshake(err error) bool {
	var operation *net.OpError
	return errors.As(err, &operation) && operation.Op == opRemoteError
}

func DescribeNetworkError(err error) string {
	hint := networkHint(err)
	if hint == "" {
		return err.Error()
	}
	return hint + "\n\n" + err.Error()
}
