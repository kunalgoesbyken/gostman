package engine

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"strings"
)

const (
	IPAuto = ""
	IPv4   = "4"
	IPv6   = "6"

	anyPort = "*"
)

type HostResolution struct {
	Host    string
	Port    string
	Address string
}

func ParseResolution(entry string) (HostResolution, error) {
	parts := strings.SplitN(strings.TrimSpace(entry), ":", 3)
	if len(parts) != 3 {
		return HostResolution{}, fmt.Errorf("write %q as host:port:address", entry)
	}
	host := strings.ToLower(strings.TrimSpace(parts[0]))
	port := strings.TrimSpace(parts[1])
	address := strings.Trim(strings.TrimSpace(parts[2]), "[]")
	if host == "" {
		return HostResolution{}, fmt.Errorf("%q has no host", entry)
	}
	if number, err := strconv.Atoi(port); port != anyPort && (err != nil || number < 1 || number > 65535) {
		return HostResolution{}, fmt.Errorf("%q has no valid port, use a number or *", entry)
	}
	if net.ParseIP(address) == nil {
		return HostResolution{}, fmt.Errorf("%q has no valid IP address", entry)
	}
	return HostResolution{Host: host, Port: port, Address: address}, nil
}

func ParseResolutions(entries []string) ([]HostResolution, error) {
	var resolutions []HostResolution
	for _, entry := range entries {
		if strings.TrimSpace(entry) == "" {
			continue
		}
		resolution, err := ParseResolution(entry)
		if err != nil {
			return nil, err
		}
		resolutions = append(resolutions, resolution)
	}
	return resolutions, nil
}

func NormalizeIPFamily(value string) (string, error) {
	switch strings.TrimPrefix(strings.ToLower(strings.TrimSpace(value)), "ipv") {
	case "", "auto", "0":
		return IPAuto, nil
	case "4":
		return IPv4, nil
	case "6":
		return IPv6, nil
	}
	return "", fmt.Errorf("choose 4, 6 or leave it empty, not %q", value)
}

func (n *Network) override(host, port string) (string, bool) {
	host = strings.ToLower(host)
	for index := len(n.resolutions) - 1; index >= 0; index-- {
		entry := n.resolutions[index]
		if entry.Host == host && (entry.Port == anyPort || entry.Port == port) {
			return entry.Address, true
		}
	}
	return "", false
}

func familyNetwork(network, family string) string {
	if family == IPAuto || (network != "tcp" && network != "tcp4" && network != "tcp6") {
		return network
	}
	return "tcp" + family
}

func matchesFamily(ip net.IP, family string) bool {
	switch family {
	case IPv4:
		return ip.To4() != nil
	case IPv6:
		return ip.To4() == nil
	}
	return true
}

func (n *Network) dialFunc(blockPrivate bool) func(ctx context.Context, network, address string) (net.Conn, error) {
	return func(ctx context.Context, network, address string) (net.Conn, error) {
		network = familyNetwork(network, n.family)
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		if forced, ok := n.override(host, port); ok {
			if blockPrivate && isBlockedIP(net.ParseIP(forced)) {
				return nil, errBlockedAddress
			}
			return dialer.DialContext(ctx, network, net.JoinHostPort(forced, port))
		}
		if blockPrivate {
			return guardedDial(ctx, network, address, n.family)
		}
		return dialer.DialContext(ctx, network, address)
	}
}
