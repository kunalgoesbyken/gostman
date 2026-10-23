package secrets

import (
	"context"
	"errors"
	"net"
	"os"
	"strings"
	"time"
	"unicode"

	"github.com/Microsoft/go-winio"
	"golang.org/x/sys/windows"
)

const (
	keepassxcDialTimeout = 3 * time.Second
	pipeFolder           = `\\.\pipe\`
)

var errForeignPipe = errors.New("the KeePassXC pipe belongs to another user")

func isASCII(text string) bool {
	return strings.IndexFunc(text, func(r rune) bool { return r > unicode.MaxASCII }) < 0
}

func renamedPipes(expected string) []string {
	listed, err := os.ReadDir(pipeFolder)
	if err != nil {
		return nil
	}
	var pipes []string
	for _, pipe := range listed {
		if strings.HasPrefix(pipe.Name(), keepassxcServer) && pipe.Name() != expected {
			pipes = append(pipes, pipeFolder+pipe.Name())
		}
	}
	return pipes
}

func ownedByUser(conn net.Conn) error {
	file, isFile := conn.(interface{ Fd() uintptr })
	if !isFile {
		return errForeignPipe
	}
	descriptor, err := windows.GetSecurityInfo(windows.Handle(file.Fd()), windows.SE_KERNEL_OBJECT, windows.OWNER_SECURITY_INFORMATION)
	if err != nil {
		return err
	}
	owner, _, err := descriptor.Owner()
	if err != nil {
		return err
	}
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		return err
	}
	if !owner.Equals(user.User.Sid) {
		return errForeignPipe
	}
	return nil
}

func dialPipe(ctx context.Context, pipe string) (net.Conn, error) {
	conn, err := winio.DialPipeContext(ctx, pipe)
	if err != nil {
		return nil, err
	}
	if err := ownedByUser(conn); err != nil {
		conn.Close()
		return nil, err
	}
	return conn, nil
}

func dialKeePassXC(ctx context.Context) (net.Conn, error) {
	ctx, cancel := context.WithTimeout(ctx, keepassxcDialTimeout)
	defer cancel()
	user := os.Getenv("USERNAME")
	expected := keepassxcServer + "_" + user
	conn, failure := dialPipe(ctx, pipeFolder+expected)
	if failure == nil || isASCII(user) {
		return conn, failure
	}
	for _, pipe := range renamedPipes(expected) {
		if conn, err := dialPipe(ctx, pipe); err == nil {
			return conn, nil
		}
	}
	return nil, failure
}
