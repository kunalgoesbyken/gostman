package engine

import (
	_ "embed"
	"encoding/json"
)

//go:embed variables.json
var catalogueJSON []byte

type catalogueFile struct {
	Variables []struct {
		Name string `json:"name"`
		Long bool   `json:"long"`
	} `json:"variables"`
	FakerAliases map[string]string `json:"fakerAliases"`
}

type catalogue struct {
	aliases  map[string]string
	longText map[string]bool
}

var builtIns = loadCatalogue()

func loadCatalogue() catalogue {
	var file catalogueFile
	if err := json.Unmarshal(catalogueJSON, &file); err != nil {
		panic(err)
	}
	loaded := catalogue{aliases: file.FakerAliases, longText: map[string]bool{}}
	for _, variable := range file.Variables {
		if variable.Long {
			loaded.longText[variable.Name] = true
		}
	}
	return loaded
}

func (c catalogue) canonical(name string) string {
	if target, ok := c.aliases[name]; ok {
		return target
	}
	return name
}
