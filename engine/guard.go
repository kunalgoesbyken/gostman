package engine

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"
)

var errBlockedAddress = errors.New("address is not reachable from the hosted proxy")

var carrierGradeNAT = &net.IPNet{IP: net.IPv4(100, 64, 0, 0), Mask: net.CIDRMask(10, 32)}

var dialer = &net.Dialer{Timeout: 15 * time.Second, KeepAlive: 30 * time.Second}

func isBlockedIP(ip net.IP) bool {
	return ip.IsLoopback() ||
		ip.IsPrivate() ||
		ip.IsUnspecified() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() ||
		ip.IsMulticast() ||
		carrierGradeNAT.Contains(ip)
}

func guardedDial(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	addresses, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	for _, candidate := range addresses {
		if isBlockedIP(candidate.IP) {
			return nil, fmt.Errorf("%w: %s resolves to %s", errBlockedAddress, host, candidate.IP)
		}
	}

	var lastErr error
	for _, candidate := range addresses {
		conn, err := dialer.DialContext(ctx, network, net.JoinHostPort(candidate.IP.String(), port))
		if err == nil {
			return conn, nil
		}
		lastErr = err
	}
	return nil, lastErr
}
