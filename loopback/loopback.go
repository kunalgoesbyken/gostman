package loopback

import (
	"fmt"
	"net"
	"strconv"
)

const (
	bindAddress = "127.0.0.1"
	highestPort = 65535
)

func CheckPort(port int) error {
	if port < 0 || port > highestPort {
		return fmt.Errorf("port %d is not valid, choose one between 1 and %d", port, highestPort)
	}
	return nil
}

func Listen(port int) (net.Listener, error) {
	listener, err := net.Listen("tcp4", net.JoinHostPort(bindAddress, strconv.Itoa(port)))
	if err != nil {
		return nil, fmt.Errorf("port %d on %s could not be opened, another program may be using it: %w", port, bindAddress, err)
	}
	return listener, nil
}

func IsHost(hostport string) bool {
	host := hostport
	if name, _, err := net.SplitHostPort(hostport); err == nil {
		host = name
	}
	if host == "localhost" {
		return true
	}
	address := net.ParseIP(host)
	return address != nil && address.IsLoopback()
}
