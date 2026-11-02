package engine

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"strconv"
	"strings"
	"unicode"
)

const (
	MethodNATS = "NATS"

	natsScheme       = "nats"
	natsDefaultPort  = "4222"
	natsModeKey      = "mode"
	natsRequest      = "request"
	natsPublish      = "publish"
	natsSubscribe    = "subscribe"
	natsLineLimit    = 4096
	natsSubscription = "1"
	natsStatusSent   = "Published"
)

type natsTarget struct {
	address  string
	subject  string
	mode     string
	user     string
	password string
	token    string
	payload  []byte
}

type natsServerInfo struct {
	MaxPayload  int64 `json:"max_payload"`
	TLSRequired bool  `json:"tls_required"`
}

type natsConnect struct {
	User      string `json:"user,omitempty"`
	Pass      string `json:"pass,omitempty"`
	AuthToken string `json:"auth_token,omitempty"`
	Name      string `json:"name"`
}

type natsFrame struct {
	op      string
	payload []byte
}

type natsConn struct {
	conn   net.Conn
	reader *bufio.Reader
}

func sendNATS(ctx context.Context, r Request, policy Policy) Response {
	target, err := newNATSTarget(r)
	if err != nil {
		return Failure(ErrorConfig, err.Error())
	}
	conn, release, err := openRaw(ctx, "tcp", target.address, policy)
	if err != nil {
		return classify(ctx, err)
	}
	defer release()
	response, err := exchangeNATS(natsConn{conn: conn, reader: bufio.NewReaderSize(conn, natsLineLimit)}, target, policy.ResponseLimit())
	if err != nil {
		return classify(ctx, err)
	}
	return response
}

func newNATSTarget(r Request) (natsTarget, error) {
	expansion, err := newSubstitution(r.Variables)
	if err != nil {
		return natsTarget{}, err
	}
	address, err := parseNATSAddress(expansion.apply(r.URL))
	if err != nil {
		return natsTarget{}, err
	}
	payload, err := rawPayload(expansion.apply(r.Body), r.BodyType)
	if err != nil {
		return natsTarget{}, err
	}
	if err := expansion.failure(); err != nil {
		return natsTarget{}, err
	}
	address.payload = payload
	return address, nil
}

func parseNATSAddress(text string) (natsTarget, error) {
	text = strings.TrimSpace(text)
	if !strings.Contains(text, "://") {
		text = natsScheme + "://" + text
	}
	parsed, err := url.Parse(text)
	if err != nil || parsed.Scheme != natsScheme || parsed.Hostname() == "" {
		return natsTarget{}, errors.New("write the address as nats://host:4222/subject")
	}
	port := parsed.Port()
	if port == "" {
		port = natsDefaultPort
	}
	target := natsTarget{address: net.JoinHostPort(parsed.Hostname(), port), subject: strings.TrimPrefix(parsed.Path, "/"), mode: parsed.Query().Get(natsModeKey)}
	if target.mode == "" {
		target.mode = natsRequest
	}
	if err := validateNATS(target); err != nil {
		return natsTarget{}, err
	}
	if parsed.User != nil {
		password, hasPassword := parsed.User.Password()
		if hasPassword {
			target.user, target.password = parsed.User.Username(), password
		} else {
			target.token = parsed.User.Username()
		}
	}
	return target, nil
}

func validateNATS(target natsTarget) error {
	switch target.mode {
	case natsRequest, natsPublish, natsSubscribe:
	default:
		return fmt.Errorf("mode must be %s, %s or %s", natsRequest, natsPublish, natsSubscribe)
	}
	if target.subject == "" || strings.ContainsFunc(target.subject, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) }) {
		return errors.New("write a subject without spaces after the address, for example nats://localhost:4222/orders.created")
	}
	return nil
}

func exchangeNATS(n natsConn, target natsTarget, limit int64) (Response, error) {
	info, err := n.greet()
	if err != nil {
		return Response{}, err
	}
	if info.TLSRequired {
		return Response{}, errors.New("this NATS server requires TLS, which Gostman does not speak yet")
	}
	if info.MaxPayload > 0 && int64(len(target.payload)) > info.MaxPayload {
		return Response{}, fmt.Errorf("the payload is larger than the server accepts (%d bytes)", info.MaxPayload)
	}
	commands, err := natsCommands(target)
	if err != nil {
		return Response{}, err
	}
	if _, err := io.WriteString(n.conn, commands); err != nil {
		return Response{}, err
	}
	address := natsScheme + "://" + target.address + "/" + target.subject
	if target.mode == natsPublish {
		if _, err := n.await("PONG", limit); err != nil {
			return Response{}, err
		}
		sent := receivedResponse(natsStatusSent, address, nil, false)
		sent.Status = fmt.Sprintf("%s %d bytes", natsStatusSent, len(target.payload))
		return sent, nil
	}
	message, err := n.await("MSG", limit)
	if err != nil {
		return Response{}, err
	}
	return receivedResponse(rawStatusReceived, address, message.payload, false), nil
}

func natsCommands(target natsTarget) (string, error) {
	connect, err := json.Marshal(natsConnect{User: target.user, Pass: target.password, AuthToken: target.token, Name: "gostman"})
	if err != nil {
		return "", err
	}
	var commands strings.Builder
	commands.WriteString("CONNECT " + string(connect) + "\r\n")
	publish := func(replyTo string) {
		fmt.Fprintf(&commands, "PUB %s %s%d\r\n%s\r\n", target.subject, replyTo, len(target.payload), target.payload)
	}
	switch target.mode {
	case natsSubscribe:
		fmt.Fprintf(&commands, "SUB %s %s\r\n", target.subject, natsSubscription)
	case natsPublish:
		publish("")
	default:
		inbox, err := natsInbox()
		if err != nil {
			return "", err
		}
		fmt.Fprintf(&commands, "SUB %s %s\r\n", inbox, natsSubscription)
		publish(inbox + " ")
	}
	commands.WriteString("PING\r\n")
	return commands.String(), nil
}

func natsInbox() (string, error) {
	random := make([]byte, 12)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	return "_INBOX." + hex.EncodeToString(random), nil
}

func (n natsConn) line() (string, error) {
	raw, err := n.reader.ReadSlice('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimRight(string(raw), "\r\n"), nil
}

func (n natsConn) greet() (natsServerInfo, error) {
	line, err := n.line()
	if err != nil {
		return natsServerInfo{}, err
	}
	body, found := strings.CutPrefix(line, "INFO ")
	if !found {
		return natsServerInfo{}, errors.New("the server did not answer like a NATS server")
	}
	var info natsServerInfo
	if err := json.Unmarshal([]byte(body), &info); err != nil {
		return natsServerInfo{}, errors.New("the NATS server sent information that could not be read")
	}
	return info, nil
}

func (n natsConn) await(op string, limit int64) (natsFrame, error) {
	for {
		frame, err := n.next(limit)
		if err != nil {
			return natsFrame{}, err
		}
		if frame.op == op {
			return frame, nil
		}
	}
}

func (n natsConn) next(limit int64) (natsFrame, error) {
	for {
		line, err := n.line()
		if err != nil {
			return natsFrame{}, err
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		switch op := strings.ToUpper(fields[0]); op {
		case "PING":
			if _, err := io.WriteString(n.conn, "PONG\r\n"); err != nil {
				return natsFrame{}, err
			}
		case "-ERR":
			return natsFrame{}, fmt.Errorf("NATS server error: %s", strings.Trim(strings.TrimSpace(strings.TrimPrefix(line, fields[0])), "'"))
		case "MSG":
			payload, err := n.payload(fields, limit)
			return natsFrame{op: op, payload: payload}, err
		case "PONG":
			return natsFrame{op: op}, nil
		}
	}
}

func (n natsConn) payload(fields []string, limit int64) ([]byte, error) {
	if len(fields) != 4 && len(fields) != 5 {
		return nil, errors.New("the NATS server sent a message that could not be read")
	}
	size, err := strconv.ParseInt(fields[len(fields)-1], 10, 64)
	if err != nil || size < 0 {
		return nil, errors.New("the NATS server sent a message that could not be read")
	}
	if size > limit {
		return nil, fmt.Errorf("the reply is larger than the %d byte limit", limit)
	}
	payload := make([]byte, size+2)
	if _, err := io.ReadFull(n.reader, payload); err != nil {
		return nil, err
	}
	return payload[:size], nil
}
