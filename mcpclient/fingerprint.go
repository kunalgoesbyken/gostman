package mcpclient

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

type toolIdentity struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	InputSchema any    `json:"inputSchema"`
}

func digest(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

func canonical(document json.RawMessage) any {
	decoder := json.NewDecoder(bytes.NewReader(document))
	decoder.UseNumber()
	var value any
	if decoder.Decode(&value) != nil {
		return string(document)
	}
	return value
}

func toolFingerprint(listed listedTool) string {
	encoded, err := json.Marshal(toolIdentity{Name: listed.Name, Description: listed.Description, InputSchema: canonical(listed.InputSchema)})
	if err != nil {
		return ""
	}
	return digest(encoded)
}

func serverKey(address string) string {
	return digest([]byte(address))
}
