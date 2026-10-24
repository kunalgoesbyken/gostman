package mcpclient

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/kunalgoesbyken/gostman/childproc"
	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	CommandPrefix = "stdio:"

	commandStatusCode = http.StatusOK
	stderrTailBytes   = 2048
	environmentJoin   = "="
	quoteDouble       = '"'
	quoteSingle       = '\''
	asciiSpace        = " \t\r\n\v\f"
)

const (
	messageCommandsOff = "local MCP servers run only in the desktop app"
	messageNoCommand   = "write the command after stdio:, for example stdio:npx -y @modelcontextprotocol/server-everything"
)

type commandLink struct {
	process *exec.Cmd
	input   io.WriteCloser
	stderr  *tail
	done    chan struct{}
	lines   chan []byte
	quit    chan struct{}
	failure error
}

type tail struct {
	mu   sync.Mutex
	data []byte
}

func (t *tail) Write(chunk []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.data = append(t.data, chunk...)
	if overflow := len(t.data) - stderrTailBytes; overflow > 0 {
		t.data = t.data[overflow:]
	}
	return len(chunk), nil
}

func (t *tail) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return strings.TrimSpace(strings.ToValidUTF8(string(t.data), "�"))
}

func commandLine(address string) (string, bool) {
	return strings.CutPrefix(strings.Trim(address, asciiSpace), CommandPrefix)
}

func IsCommand(address string) bool {
	_, ok := commandLine(address)
	return ok
}

func splitCommand(line string) ([]string, error) {
	var args []string
	var current strings.Builder
	var quote rune
	inArgument := false
	for _, character := range line {
		switch {
		case quote != 0 && character == quote:
			quote = 0
		case quote != 0:
			current.WriteRune(character)
		case character == quoteDouble || character == quoteSingle:
			quote, inArgument = character, true
		case unicode.IsSpace(character):
			if inArgument {
				args = append(args, current.String())
				current.Reset()
				inArgument = false
			}
		default:
			current.WriteRune(character)
			inArgument = true
		}
	}
	if quote != 0 {
		return nil, configError("the command has an unclosed %c quote", quote)
	}
	if inArgument {
		args = append(args, current.String())
	}
	return args, nil
}

func commandEnvironment(expansion *engine.Expansion, rows string) ([]string, error) {
	variables, err := expansion.Headers(rows, engine.Auth{})
	if err != nil {
		return nil, configError("%v", err)
	}
	environment := os.Environ()
	for _, variable := range variables {
		if strings.TrimSpace(variable.Key) != "" {
			environment = append(environment, variable.Key+environmentJoin+variable.Value)
		}
	}
	return environment, nil
}

func openCommand(ctx context.Context, command string, target Target, expansion *engine.Expansion, policy engine.Policy) (*session, error) {
	if !policy.RunCommands {
		return nil, configError(messageCommandsOff)
	}
	line := strings.TrimSpace(expansion.Text(command))
	args, err := splitCommand(line)
	if err != nil {
		return nil, err
	}
	if len(args) == 0 {
		return nil, configError(messageNoCommand)
	}
	environment, err := commandEnvironment(expansion, target.Headers)
	if err != nil {
		return nil, err
	}
	if err := expansion.Err(); err != nil {
		return nil, configError("%v", err)
	}
	limit := policy.ResponseLimit()
	start := func(ctx context.Context) (link, error) { return startCommand(ctx, args, environment, limit) }
	started, err := start(ctx)
	if err != nil {
		return nil, err
	}
	return &session{link: started, reopen: start, address: CommandPrefix + line, expansion: expansion, limit: limit, started: time.Now()}, nil
}

func startCommand(ctx context.Context, args []string, environment []string, limit int64) (*commandLink, error) {
	process := exec.CommandContext(ctx, args[0], args[1:]...)
	process.Env = environment
	childproc.NoWindow(process)
	input, err := process.StdinPipe()
	if err != nil {
		return nil, configError("%v", err)
	}
	output, err := process.StdoutPipe()
	if err != nil {
		return nil, configError("%v", err)
	}
	stderr := &tail{}
	process.Stderr = stderr
	if err := process.Start(); err != nil {
		return nil, configError("the command could not start: %v", err)
	}
	started := &commandLink{
		process: process,
		input:   input,
		stderr:  stderr,
		done:    make(chan struct{}),
		lines:   make(chan []byte),
		quit:    make(chan struct{}),
	}
	go started.pump(bufio.NewReader(output), limit)
	go func() {
		process.Wait()
		close(started.done)
	}()
	return started, nil
}

func (c *commandLink) pump(output *bufio.Reader, limit int64) {
	defer close(c.lines)
	for {
		line, err := readLine(output, limit)
		if err != nil {
			c.failure = err
			return
		}
		select {
		case c.lines <- line:
		case <-c.quit:
			return
		}
	}
}

func (c *commandLink) exited() bool {
	select {
	case <-c.done:
		return true
	default:
		return false
	}
}

func (c *commandLink) write(payload any) error {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return configError("the message cannot be encoded: %v", err)
	}
	if _, err := c.input.Write(append(encoded, '\n')); err != nil {
		return c.stopped()
	}
	return nil
}

func (c *commandLink) stopped() error {
	detail := c.stderr.String()
	if detail == "" {
		return protocolError("the command stopped before it answered")
	}
	return protocolError("the command stopped before it answered: %s", detail)
}

func readLine(output *bufio.Reader, limit int64) ([]byte, error) {
	var line []byte
	for {
		chunk, err := output.ReadSlice('\n')
		line = append(line, chunk...)
		if int64(len(line)) > limit {
			return nil, answerTooLarge(limit)
		}
		if err == nil {
			return line, nil
		}
		if !errors.Is(err, bufio.ErrBufferFull) {
			return nil, err
		}
	}
}

func (c *commandLink) next(ctx context.Context) ([]byte, error) {
	select {
	case line, open := <-c.lines:
		if open {
			return line, nil
		}
		var tooLarge *failure
		if errors.As(c.failure, &tooLarge) {
			return nil, c.failure
		}
		return nil, c.stopped()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (c *commandLink) roundTrip(ctx context.Context, request outgoing, limit int64) (answer, envelope, error) {
	received := answer{status: statusOK, code: commandStatusCode}
	if err := c.write(request.message); err != nil {
		return received, envelope{}, err
	}
	for {
		line, err := c.next(ctx)
		if err != nil {
			return received, envelope{}, err
		}
		if int64(len(line)) > limit {
			return received, envelope{}, answerTooLarge(limit)
		}
		reply, done, err := received.take(line, request.id, c.write)
		if err != nil || done {
			return received, reply, err
		}
	}
}

func (c *commandLink) deliver(_ context.Context, payload any) error {
	return c.write(payload)
}

func (c *commandLink) established(string, string) {}

func (c *commandLink) close() {
	close(c.quit)
	c.input.Close()
	select {
	case <-c.done:
	case <-time.After(farewellTimeout):
		c.process.Process.Kill()
		<-c.done
	}
}
