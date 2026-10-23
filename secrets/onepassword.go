package secrets

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"
)

const (
	onePasswordScheme     = "op://"
	onePasswordTokenEnv   = "OP_SERVICE_ACCOUNT_TOKEN"
	onePasswordAccount    = "--account"
	onePasswordError      = "[ERROR] "
	onePasswordReadFailed = "could not read secret '"
)

var (
	onePasswordTool = tool{
		program: "op",
		label:   "1Password CLI (op)",
		install: "https://developer.1password.com/docs/cli/get-started/",
		timeout: 2 * time.Minute,
	}
	errOnePasswordSignedOut = errors.New("1Password CLI is not signed in. In the 1Password app, turn on Settings → Developer → Integrate with 1Password CLI and unlock the app, or add a service account token to the connection")
	errOnePasswordBadToken  = errors.New("1Password did not accept the service account token on the connection. Copy it again from the service account's page, or clear it to use the 1Password app instead")
	onePasswordBadToken     = []string{"DecodeSACredentials", "invalid service account token", "Unauthorized"}
	onePasswordSignedOut    = []string{"No accounts configured", "not currently signed in", "LostConnectionToApp", "connectionreset", "authorization prompt dismissed", "account is not signed in"}
)

type onePassword struct {
	account string
	token   string
	program string
}

func newOnePassword(connection Connection, _ *gateway) (Provider, error) {
	return &onePassword{
		account: connection.value(fieldAccount),
		token:   connection.value(fieldToken),
		program: connection.value(fieldCommand),
	}, nil
}

func (o *onePassword) Volatile(ref Ref) bool {
	return readsOneTimeCode(ref)
}

func isWordRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r)
}

func isReferenceSafe(segment string) bool {
	return strings.IndexFunc(segment, isWordRune) >= 0 && strings.IndexFunc(segment, func(r rune) bool {
		return !isWordRune(r) && !strings.ContainsRune(" -_.", r)
	}) < 0
}

func onePasswordTarget(ref Ref) ([]string, string, error) {
	segments := ref.segments()
	if len(segments) < 2 || len(segments) > 3 {
		return nil, "", errors.New("write the path as vault/item, or vault/item/section, such as Private/Stripe")
	}
	field := ref.Field
	if field == "" {
		field = entryPassword
	}
	if field == entryTOTP && len(segments) == 3 {
		return nil, "", errors.New("a one-time password belongs to the whole item, so write the path as vault/item without a section")
	}
	for _, part := range append(segments, field) {
		if !isReferenceSafe(part) {
			return nil, "", fmt.Errorf("%q has characters that 1Password references cannot contain; use the ID of the vault, item or field instead", part)
		}
	}
	return segments, field, nil
}

func (o *onePassword) arguments(segments []string, field string) []string {
	var args []string
	if field == entryTOTP {
		args = []string{"item", "get", "--vault", segments[0], "--otp"}
	} else {
		args = []string{"read", "--no-newline"}
	}
	if o.account != "" {
		args = append(args, onePasswordAccount, o.account)
	}
	if field == entryTOTP {
		return append(args, "--", segments[1])
	}
	return append(args, "--", onePasswordScheme+strings.Join(append(segments, field), "/"))
}

func (o *onePassword) Resolve(ctx context.Context, ref Ref) (string, error) {
	if err := noVersions(ref, "1Password"); err != nil {
		return "", err
	}
	segments, field, err := onePasswordTarget(ref)
	if err != nil {
		return "", err
	}
	program, err := onePasswordTool.locate(o.program)
	if err != nil {
		return "", err
	}
	env := map[string]string{}
	if o.token != "" {
		env[onePasswordTokenEnv] = o.token
	}
	result, err := onePasswordTool.run(ctx, program, o.arguments(segments, field), env)
	if err != nil {
		return "", err
	}
	if result.failed {
		return "", onePasswordProblem(result.stderr, segments)
	}
	return strings.TrimRight(string(result.stdout), "\r\n"), nil
}

func onePasswordMessage(stderr string) string {
	for _, line := range strings.Split(stderr, "\n") {
		if at := strings.Index(line, onePasswordError); at >= 0 {
			if parts := strings.SplitN(strings.TrimSpace(line[at+len(onePasswordError):]), " ", 3); len(parts) == 3 {
				return withoutReference(parts[2])
			}
		}
	}
	return firstLine(stderr)
}

func withoutReference(message string) string {
	if !strings.HasPrefix(message, onePasswordReadFailed) {
		return message
	}
	if _, rest, found := strings.Cut(message, "': "); found {
		return rest
	}
	return message
}

func containsAny(text string, signals []string) bool {
	for _, signal := range signals {
		if strings.Contains(text, signal) {
			return true
		}
	}
	return false
}

func onePasswordProblem(stderr string, segments []string) error {
	message := onePasswordMessage(stderr)
	switch {
	case containsAny(stderr, onePasswordSignedOut):
		return errOnePasswordSignedOut
	case containsAny(stderr, onePasswordBadToken):
		return errOnePasswordBadToken
	case strings.Contains(stderr, "More than one item matches"):
		return fmt.Errorf("more than one 1Password item matches %q; use the item's ID instead", segments[1])
	case message == "":
		return errors.New("1Password CLI failed without saying why")
	}
	return fmt.Errorf("1Password CLI: %s", message)
}
