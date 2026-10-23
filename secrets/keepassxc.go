package secrets

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"time"

	"golang.org/x/crypto/nacl/box"
)

const (
	keepassxcServer        = "org.keepassxc.KeePassXC.BrowserServer"
	keepassxcByPath        = "keepassxc://by-path/"
	keepassxcByUUID        = "keepassxc://by-uuid/"
	keepassxcAttribute     = "KPH: "
	keepassxcTrue          = "true"
	keepassxcUnlocked      = "database-unlocked"
	keepassxcReplyTimeout  = 10 * time.Second
	keepassxcPromptTimeout = 2 * time.Minute
	keepassxcMaxBytes      = 4 << 20
	keepassxcUUIDLength    = 32

	actionChangeKeys    = "change-public-keys"
	actionAssociate     = "associate"
	actionTestAssociate = "test-associate"
	actionGetLogins     = "get-logins"

	entryPassword = "password"
	entryUsername = "username"
	entryTitle    = "title"
	entryTOTP     = "totp"

	codeDatabaseLocked    = "1"
	codeCancelled         = "6"
	codeAssociationFailed = "8"
	codeNoLogins          = "15"
)

var (
	errKeePassXCUnreachable = errors.New("KeePassXC is not running, or its browser integration is off. Open KeePassXC, turn on Enable browser integration under Settings → Browser Integration, and try again")
	errKeePassXCLocked      = errors.New("the KeePassXC database is locked. Unlock it in KeePassXC and try again")
	errKeePassXCUnpaired    = errors.New("KeePassXC does not recognise this connection, or the database it was made with is not open. Open that database in KeePassXC, or edit the connection under Secret managers and select Connect again")
	errKeePassXCRefused     = errors.New("KeePassXC did not allow the connection. If no KeePassXC window appeared, bring KeePassXC to the front, unlock the database and try again")
	errKeePassXCSlow        = errors.New("KeePassXC did not answer in time")
	errKeePassXCBusy        = errors.New("KeePassXC is busy with another request from Gostman, such as a connection waiting for your approval. Answer KeePassXC and try again")
	errKeePassXCFrozen      = errors.New("KeePassXC did not answer in time. If it stopped responding, the entry probably has no URL: KeePassXC 2.7.0 to 2.8.0 freezes when an app reads an entry without one. Restart KeePassXC and give the entry a URL, any address works")

	keepassxcClientID = newClientID()
	keepassxcTurn     = make(chan struct{}, 1)
	unlockRequest     = map[string]string{"triggerUnlock": keepassxcTrue}
)

type keepassxc struct {
	association string
	key         string
}

type keepassxcSession struct {
	conn     net.Conn
	decoder  *json.Decoder
	public   *[32]byte
	private  *[32]byte
	server   [32]byte
	clientID string
}

type keepassxcReply struct {
	Action    string `json:"action"`
	Message   string `json:"message"`
	Nonce     string `json:"nonce"`
	PublicKey string `json:"publicKey"`
	Success   string `json:"success"`
	Error     string `json:"error"`
	ErrorCode string `json:"errorCode"`
}

type keepassxcProblem struct {
	code string
	text string
}

func (p keepassxcProblem) Error() string {
	return fmt.Sprintf("KeePassXC answered: %s (code %s)", p.text, p.code)
}

type keepassxcEntry struct {
	Login        string              `json:"login"`
	Password     string              `json:"password"`
	Name         string              `json:"name"`
	UUID         string              `json:"uuid"`
	TOTP         string              `json:"totp"`
	StringFields []map[string]string `json:"stringFields"`
}

func newClientID() string {
	raw := make([]byte, 24)
	rand.Read(raw)
	return base64.StdEncoding.EncodeToString(raw)
}

func newKeePassXC(connection Connection, _ *gateway) (Provider, error) {
	provider := &keepassxc{association: connection.value(fieldAssociation), key: connection.value(fieldAssociationKey)}
	if provider.association == "" || provider.key == "" {
		return nil, errors.New("is not connected to KeePassXC yet; edit it under Secret managers and select Connect to KeePassXC")
	}
	return provider, nil
}

func pairKeePassXC(ctx context.Context) (map[string]string, error) {
	release, err := takeTurn(ctx)
	if err != nil {
		return nil, err
	}
	defer release()
	session, err := openKeePassXC(ctx)
	if err != nil {
		return nil, err
	}
	defer session.close()
	identity, _, err := box.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	key := base64.StdEncoding.EncodeToString(identity[:])
	var answer struct {
		ID string `json:"id"`
	}
	request := map[string]any{"key": session.publicKey(), "idKey": key}
	associate := func() error {
		return session.request(ctx, actionAssociate, request, unlockRequest, keepassxcPromptTimeout, &answer)
	}
	if err := session.unlocked(ctx, associate); err != nil {
		return nil, pairingProblem(err)
	}
	if answer.ID == "" {
		return nil, errKeePassXCRefused
	}
	return map[string]string{fieldAssociation: answer.ID, fieldAssociationKey: key}, nil
}

func takeTurn(ctx context.Context) (func(), error) {
	wait, cancel := context.WithTimeout(ctx, keepassxcPromptTimeout)
	defer cancel()
	select {
	case keepassxcTurn <- struct{}{}:
		return func() { <-keepassxcTurn }, nil
	case <-wait.Done():
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, errKeePassXCBusy
	}
}

func pairingProblem(err error) error {
	var problem keepassxcProblem
	if !errors.As(err, &problem) {
		return err
	}
	switch problem.code {
	case codeCancelled:
		return errKeePassXCRefused
	case codeDatabaseLocked:
		return errKeePassXCLocked
	}
	return err
}

func (k *keepassxc) Volatile(ref Ref) bool {
	return readsOneTimeCode(ref)
}

func (k *keepassxc) Resolve(ctx context.Context, ref Ref) (string, error) {
	if err := noVersions(ref, "KeePassXC"); err != nil {
		return "", err
	}
	release, err := takeTurn(ctx)
	if err != nil {
		return "", err
	}
	defer release()
	session, err := openKeePassXC(ctx)
	if err != nil {
		return "", err
	}
	defer session.close()
	if err := session.unlocked(ctx, func() error { return session.identify(ctx, k) }); err != nil {
		return "", err
	}
	entry, err := session.entry(ctx, k, ref.Path)
	if err != nil {
		return "", err
	}
	return entry.read(ref.Field)
}

func openKeePassXC(ctx context.Context) (*keepassxcSession, error) {
	conn, err := dialKeePassXC(ctx)
	if err != nil {
		return nil, errKeePassXCUnreachable
	}
	public, private, err := box.GenerateKey(rand.Reader)
	if err != nil {
		conn.Close()
		return nil, err
	}
	session := &keepassxcSession{
		conn:     conn,
		decoder:  json.NewDecoder(io.LimitReader(conn, keepassxcMaxBytes)),
		public:   public,
		private:  private,
		clientID: keepassxcClientID,
	}
	if err := session.exchangeKeys(ctx); err != nil {
		conn.Close()
		return nil, err
	}
	return session, nil
}

func (s *keepassxcSession) close() {
	s.conn.Close()
}

func (s *keepassxcSession) publicKey() string {
	return base64.StdEncoding.EncodeToString(s.public[:])
}

func newNonce() [24]byte {
	var nonce [24]byte
	rand.Read(nonce[:])
	return nonce
}

func incremented(nonce [24]byte) [24]byte {
	for i := range nonce {
		nonce[i]++
		if nonce[i] != 0 {
			break
		}
	}
	return nonce
}

func (s *keepassxcSession) exchangeKeys(ctx context.Context) error {
	nonce := newNonce()
	request := map[string]string{
		"action":    actionChangeKeys,
		"publicKey": s.publicKey(),
		"nonce":     base64.StdEncoding.EncodeToString(nonce[:]),
		"clientID":  s.clientID,
	}
	reply, err := s.roundTrip(ctx, request, keepassxcReplyTimeout)
	if err != nil {
		return err
	}
	if err := reply.problem(); err != nil {
		return err
	}
	server, err := base64.StdEncoding.DecodeString(reply.PublicKey)
	if err != nil || len(server) != len(s.server) || reply.Success != keepassxcTrue {
		return errors.New("KeePassXC sent an unreadable key")
	}
	copy(s.server[:], server)
	return nil
}

func (s *keepassxcSession) request(ctx context.Context, action string, message map[string]any, extra map[string]string, timeout time.Duration, answer any) error {
	nonce := newNonce()
	message["action"] = action
	plain, err := json.Marshal(message)
	if err != nil {
		return err
	}
	envelope := map[string]string{
		"action":   action,
		"message":  base64.StdEncoding.EncodeToString(box.Seal(nil, plain, &nonce, &s.server, s.private)),
		"nonce":    base64.StdEncoding.EncodeToString(nonce[:]),
		"clientID": s.clientID,
	}
	for name, value := range extra {
		envelope[name] = value
	}
	reply, err := s.roundTrip(ctx, envelope, timeout)
	if err != nil {
		return err
	}
	if err := reply.problem(); err != nil {
		return err
	}
	return s.open(reply, incremented(nonce), answer)
}

func (s *keepassxcSession) open(reply keepassxcReply, expected [24]byte, answer any) error {
	nonce, err := base64.StdEncoding.DecodeString(reply.Nonce)
	if err != nil || len(nonce) != len(expected) || [24]byte(nonce) != expected {
		return errors.New("KeePassXC answered with an unexpected nonce")
	}
	sealed, err := base64.StdEncoding.DecodeString(reply.Message)
	if err != nil {
		return errors.New("KeePassXC sent an unreadable answer")
	}
	plain, isValid := box.Open(nil, sealed, &expected, &s.server, s.private)
	if !isValid {
		return errors.New("KeePassXC sent an answer that could not be decrypted")
	}
	if err := json.Unmarshal(plain, answer); err != nil {
		return errors.New("KeePassXC sent an unreadable answer")
	}
	return nil
}

func (s *keepassxcSession) roundTrip(ctx context.Context, request map[string]string, timeout time.Duration) (keepassxcReply, error) {
	payload, err := json.Marshal(request)
	if err != nil {
		return keepassxcReply{}, err
	}
	stop := s.watch(ctx, timeout)
	defer stop()
	if _, err := s.conn.Write(payload); err != nil {
		return keepassxcReply{}, s.transportProblem(ctx, err)
	}
	return s.await(ctx, request["action"])
}

func (s *keepassxcSession) await(ctx context.Context, action string) (keepassxcReply, error) {
	for {
		var reply keepassxcReply
		if err := s.decoder.Decode(&reply); err != nil {
			return keepassxcReply{}, s.transportProblem(ctx, err)
		}
		if reply.Action == action {
			return reply, nil
		}
	}
}

func (s *keepassxcSession) watch(ctx context.Context, timeout time.Duration) func() {
	s.conn.SetDeadline(time.Now().Add(timeout))
	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			s.conn.SetDeadline(time.Now())
		case <-done:
		}
	}()
	return func() { close(done) }
}

func (s *keepassxcSession) transportProblem(ctx context.Context, err error) error {
	switch {
	case ctx.Err() != nil:
		return ctx.Err()
	case isTimeout(err):
		return errKeePassXCSlow
	}
	return fmt.Errorf("the connection to KeePassXC failed: %w", err)
}

func (r keepassxcReply) problem() error {
	if r.ErrorCode == "" && r.Error == "" {
		return nil
	}
	return keepassxcProblem{code: r.ErrorCode, text: r.Error}
}

func (s *keepassxcSession) unlocked(ctx context.Context, step func() error) error {
	err := step()
	var problem keepassxcProblem
	if !errors.As(err, &problem) || problem.code != codeDatabaseLocked {
		return err
	}
	if err := s.awaitUnlock(ctx); err != nil {
		return err
	}
	return step()
}

func (s *keepassxcSession) awaitUnlock(ctx context.Context) error {
	stop := s.watch(ctx, keepassxcPromptTimeout)
	defer stop()
	if _, err := s.await(ctx, keepassxcUnlocked); err != nil {
		if errors.Is(err, errKeePassXCSlow) {
			return errKeePassXCLocked
		}
		return err
	}
	return nil
}

func (s *keepassxcSession) identify(ctx context.Context, k *keepassxc) error {
	var answer struct{}
	message := map[string]any{"id": k.association, "key": k.key}
	if err := s.request(ctx, actionTestAssociate, message, unlockRequest, keepassxcReplyTimeout, &answer); err != nil {
		var problem keepassxcProblem
		if errors.As(err, &problem) && problem.code == codeAssociationFailed {
			return errKeePassXCUnpaired
		}
		return err
	}
	return nil
}

var uuidDecoration = strings.NewReplacer("{", "", "}", "", "-", "")

func entryAddress(path string) string {
	trimmed := strings.Trim(path, "/")
	uuid := strings.ToLower(uuidDecoration.Replace(trimmed))
	if len(uuid) == keepassxcUUIDLength && strings.Trim(uuid, "0123456789abcdef") == "" {
		return keepassxcByUUID + uuid
	}
	return keepassxcByPath + trimmed
}

func (s *keepassxcSession) entry(ctx context.Context, k *keepassxc, path string) (keepassxcEntry, error) {
	var answer struct {
		Entries []keepassxcEntry `json:"entries"`
	}
	message := map[string]any{
		"url":  entryAddress(path),
		"keys": []map[string]string{{"id": k.association, "key": k.key}},
	}
	if err := s.request(ctx, actionGetLogins, message, nil, keepassxcPromptTimeout, &answer); err != nil {
		var problem keepassxcProblem
		if errors.As(err, &problem) {
			switch problem.code {
			case codeNoLogins:
				return keepassxcEntry{}, missingEntry(path)
			case codeDatabaseLocked:
				return keepassxcEntry{}, errKeePassXCLocked
			case codeAssociationFailed:
				return keepassxcEntry{}, errKeePassXCUnpaired
			}
		}
		if errors.Is(err, errKeePassXCSlow) {
			return keepassxcEntry{}, errKeePassXCFrozen
		}
		return keepassxcEntry{}, err
	}
	switch len(answer.Entries) {
	case 0:
		return keepassxcEntry{}, missingEntry(path)
	case 1:
		return answer.Entries[0], nil
	}
	return keepassxcEntry{}, fmt.Errorf("%d KeePassXC entries are at %q; use the UUID of the one you mean, shown in the entry's Advanced tab in KeePassXC", len(answer.Entries), path)
}

func missingEntry(path string) error {
	return fmt.Errorf("KeePassXC returned no entry at %q. The path starts below the root group and is case-sensitive, such as Work/API keys/Stripe. KeePassXC also returns nothing when access was denied, when the entry is expired, or when the entry is in another database than the one this connection was made with", path)
}

func (e keepassxcEntry) fields() map[string]string {
	fields := map[string]string{}
	for _, attribute := range e.StringFields {
		for name, value := range attribute {
			fields[strings.TrimPrefix(name, keepassxcAttribute)] = value
		}
	}
	fields[entryTitle] = e.Name
	fields[entryUsername] = e.Login
	fields[entryPassword] = e.Password
	if e.TOTP != "" {
		fields[entryTOTP] = e.TOTP
	}
	return fields
}

func (e keepassxcEntry) read(field string) (string, error) {
	return pickField(e.fields(), strings.TrimPrefix(field, keepassxcAttribute), entryPassword, ". KeePassXC only shares attributes whose names start with \"KPH: \"")
}
