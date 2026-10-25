package engine

import (
	"errors"
	"net"

	"github.com/kunalgoesbyken/gostman/locales"
)

const opRemoteError = "remote error"

type Advice struct {
	UntrustedAuthority string
	ClientCertificate  string
}

var AppAdvice = Advice{
	UntrustedAuthority: locales.New(locales.EngineAdviceUntrustedAuthority, nil).English(),
	ClientCertificate:  locales.New(locales.EngineAdviceClientCertificate, nil).English(),
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
	if hint == nil {
		return err.Error()
	}
	return hint.WithDetail(err.Error()).String()
}
