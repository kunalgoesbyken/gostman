package runner

import (
	"bytes"
	"os"

	"golang.org/x/text/encoding/unicode"
)

var (
	utf16LittleEndianMark = []byte{0xff, 0xfe}
	utf16BigEndianMark    = []byte{0xfe, 0xff}
)

func ReadText(path string) ([]byte, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if bytes.HasPrefix(content, utf16LittleEndianMark) || bytes.HasPrefix(content, utf16BigEndianMark) {
		return unicode.UTF16(unicode.LittleEndian, unicode.UseBOM).NewDecoder().Bytes(content)
	}
	return bytes.TrimPrefix(content, []byte(byteOrderMark)), nil
}
