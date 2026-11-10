package engine

import (
	cryptorand "crypto/rand"
	"encoding/binary"
	"fmt"
	"math/rand/v2"
	"time"
)

const (
	uuidVersion4  = 0x40
	uuidVersion7  = 0x70
	uuidVariantRF = 0x80
	uuidStampSize = 6
)

func newGUID() string {
	return formatUUID(randomUUIDBytes(), uuidVersion4)
}

func newUUIDv7() string {
	raw := randomUUIDBytes()
	var stamp [8]byte
	binary.BigEndian.PutUint64(stamp[:], uint64(time.Now().UnixMilli()))
	copy(raw[:uuidStampSize], stamp[len(stamp)-uuidStampSize:])
	return formatUUID(raw, uuidVersion7)
}

func randomUUIDBytes() [16]byte {
	var raw [16]byte
	if _, err := cryptorand.Read(raw[:]); err != nil {
		for i := range raw {
			raw[i] = byte(rand.IntN(256))
		}
	}
	return raw
}

func formatUUID(raw [16]byte, version byte) string {
	raw[6] = raw[6]&0x0f | version
	raw[8] = raw[8]&0x3f | uuidVariantRF
	return fmt.Sprintf("%x-%x-%x-%x-%x", raw[0:4], raw[4:6], raw[6:8], raw[8:10], raw[10:])
}
