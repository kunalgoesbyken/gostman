package engine

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"
)

var errBlockedAddress = errors.New("address is not reachable from the hosted proxy")

var blockedNetworks = mustParseCIDRs(
	"0.0.0.0/8",
	"100.64.0.0/10",
	"192.0.0.0/24",
	"192.0.2.0/24",
	"192.88.99.0/24",
	"198.18.0.0/15",
	"198.51.100.0/24",
	"203.0.113.0/24",
	"240.0.0.0/4",
	"::/96",
	"::ffff:0:0:0/96",
	"64:ff9b::/96",
	"64:ff9b:1::/48",
	"2001::/32",
	"2001:db8::/32",
	"2001:10::/28",
	"2001:20::/28",
	"2002::/16",
	"100::/64",
	"3fff::/20",
	"5f00::/16",
	"fec0::/10",
)

var dialer = &net.Dialer{Timeout: 15 * time.Second, KeepAlive: 30 * time.Second}

func mustParseCIDRs(cidrs ...string) []*net.IPNet {
	networks := make([]*net.IPNet, 0, len(cidrs))
	for _, cidr := range cidrs {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(err)
		}
		networks = append(networks, network)
	}
	return networks
}

func isBlockedIP(ip net.IP) bool {
	if !ip.IsGlobalUnicast() || ip.IsPrivate() {
		return true
	}
	for _, network := range blockedNetworks {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

func DialContext(policy Policy) func(ctx context.Context, network, address string) (net.Conn, error) {
	if policy.BlockPrivate {
		return guardedDial
	}
	return dialer.DialContext
}

func IsBlockedAddress(err error) bool {
	return errors.Is(err, errBlockedAddress)
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
