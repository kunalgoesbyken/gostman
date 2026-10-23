package secrets

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	bwsTokenEnv  = "BWS_ACCESS_TOKEN"
	bwsServerEnv = "BWS_SERVER_URL"
	bwsValue     = "value"
	bwsKey       = "key"
	bwsNote      = "note"
)

var (
	errBWSBadToken = errors.New("Bitwarden Secrets Manager did not accept the access token on the connection. Create a new access token for the machine account and paste it in")
	bwsBadToken    = []string{"Missing access token", "Doesn't contain a decryption key", "Unauthorized"}
)

var bwsTool = tool{
	program: "bws",
	label:   "Bitwarden Secrets Manager CLI (bws)",
	install: "https://bitwarden.com/help/secrets-manager-cli/",
	timeout: 30 * time.Second,
}

type bws struct {
	token   string
	address string
	program string
}

func newBWS(connection Connection, _ *gateway) (Provider, error) {
	provider := &bws{token: connection.value(fieldToken), address: connection.value(fieldAddress), program: connection.value(fieldCommand)}
	if provider.token == "" {
		return nil, errors.New("needs a machine account access token")
	}
	if provider.address != "" {
		if _, err := parseAddress(provider.address, fieldAddress); err != nil {
			return nil, err
		}
	}
	return provider, nil
}

func (b *bws) Volatile(Ref) bool {
	return false
}

func (b *bws) Resolve(ctx context.Context, ref Ref) (string, error) {
	if err := noVersions(ref, "Bitwarden Secrets Manager"); err != nil {
		return "", err
	}
	id := strings.TrimSpace(ref.Path)
	if !isGUID(id) {
		return "", fmt.Errorf("Bitwarden Secrets Manager reads a secret by its ID, such as be8e0ad8-d545-4017-a55a-b02f014d4158, not %q", ref.Path)
	}
	program, err := bwsTool.locate(b.program)
	if err != nil {
		return "", err
	}
	env := map[string]string{bwsTokenEnv: b.token}
	if b.address != "" {
		env[bwsServerEnv] = b.address
	}
	result, err := bwsTool.run(ctx, program, []string{"secret", "get", id, "--output", "json", "--color", "no"}, env)
	if err != nil {
		return "", err
	}
	if result.failed {
		return "", bwsProblem(result.stderr)
	}
	var secret map[string]string
	if err := json.Unmarshal(result.stdout, &secret); err != nil {
		return "", errors.New("Bitwarden Secrets Manager CLI gave an answer that could not be read")
	}
	return pickField(map[string]string{bwsValue: secret[bwsValue], bwsKey: secret[bwsKey], bwsNote: secret[bwsNote]}, ref.Field, bwsValue, "")
}

func bwsCauses(stderr string) []string {
	var causes []string
	for _, line := range strings.Split(stderr, "\n") {
		number, cause, found := strings.Cut(strings.TrimSpace(line), ": ")
		if !found || strings.Trim(number, "0123456789") != "" || number == "" {
			if len(causes) > 0 {
				break
			}
			continue
		}
		causes = append(causes, strings.TrimSpace(cause))
	}
	return causes
}

func bwsProblem(stderr string) error {
	message := strings.Join(bwsCauses(stderr), ": ")
	switch {
	case message == "":
		message = firstLine(stderr)
	case containsAny(message, bwsBadToken):
		return errBWSBadToken
	}
	if message == "" {
		return errors.New("Bitwarden Secrets Manager CLI failed without saying why")
	}
	return fmt.Errorf("Bitwarden Secrets Manager CLI: %s", message)
}
