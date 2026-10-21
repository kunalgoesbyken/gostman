package engine

import (
	"bytes"
	"strconv"
	"strings"
)

const (
	BodySOAP = "soap"

	headerSOAPAction  = "SOAPAction"
	soap12Namespace   = "http://www.w3.org/2003/05/soap-envelope"
	contentTypeSOAP11 = "text/xml; charset=utf-8"
	contentTypeSOAP12 = "application/soap+xml; charset=utf-8"
	emptySOAPAction   = `""`
)

func soapHeaders(headers []pair, body []byte) ([]pair, string) {
	if bytes.Contains(body, []byte(soap12Namespace)) {
		return soap12Headers(headers)
	}
	if hasHeader(headers, headerSOAPAction) {
		return headers, contentTypeSOAP11
	}
	return append(headers, pair{headerSOAPAction, emptySOAPAction}), contentTypeSOAP11
}

func soap12Headers(headers []pair) ([]pair, string) {
	kept := make([]pair, 0, len(headers))
	action := ""
	found := false
	for _, header := range headers {
		if strings.EqualFold(header.key, headerSOAPAction) {
			action, found = header.value, true
			continue
		}
		kept = append(kept, header)
	}
	if !found {
		return kept, contentTypeSOAP12
	}
	return kept, contentTypeSOAP12 + "; action=" + strconv.Quote(strings.Trim(action, `"`))
}
