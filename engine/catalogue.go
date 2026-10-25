package engine

import (
	_ "embed"
	"encoding/json"
)

//go:embed variables.json
var catalogueJSON []byte

type catalogueFile struct {
	FakerAliases map[string]string `json:"fakerAliases"`
}

type catalogue struct {
	aliases map[string]string
}

var builtIns = loadCatalogue()

func loadCatalogue() catalogue {
	var file catalogueFile
	if err := json.Unmarshal(catalogueJSON, &file); err != nil {
		panic(err)
	}
	return catalogue{aliases: file.FakerAliases}
}

func (c catalogue) canonical(name string) string {
	if target, ok := c.aliases[name]; ok {
		return target
	}
	return name
}
