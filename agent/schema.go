package agent

import (
	"encoding/json"
	"reflect"
	"strings"
	"time"
)

type schema map[string]any

func described(kind, description string) schema {
	return schema{"type": kind, "description": description}
}

func text(description string) schema {
	return described("string", description)
}

func flag(description string) schema {
	return described("boolean", description)
}

func choice(description string, options []string) schema {
	chosen := text(description)
	chosen["enum"] = options
	return chosen
}

func whole(description string, minimum, maximum int) schema {
	number := described("integer", description)
	number["minimum"] = minimum
	number["maximum"] = maximum
	return number
}

func textMap(description string) schema {
	mapping := described("object", description)
	mapping["additionalProperties"] = schema{"type": "string"}
	return mapping
}

func list(description string, items schema) schema {
	listed := described("array", description)
	listed["items"] = items
	return listed
}

func object(properties map[string]schema, required ...string) schema {
	shape := schema{"type": "object", "properties": properties, "additionalProperties": false}
	if len(required) > 0 {
		shape["required"] = required
	}
	return shape
}

var rawJSON = reflect.TypeFor[json.RawMessage]()

func jsonType(kind reflect.Type) any {
	switch kind.Kind() {
	case reflect.String:
		return "string"
	case reflect.Bool:
		return "boolean"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "integer"
	case reflect.Float32, reflect.Float64:
		return "number"
	case reflect.Struct:
		if kind.ConvertibleTo(reflect.TypeFor[time.Time]()) {
			return "string"
		}
		return "object"
	case reflect.Slice, reflect.Array:
		return []string{"array", "null"}
	case reflect.Map:
		return []string{"object", "null"}
	case reflect.Pointer:
		return []string{"object", "null"}
	}
	return nil
}

func fieldShapes(kind reflect.Type, properties map[string]schema) {
	for index := range kind.NumField() {
		field := kind.Field(index)
		name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
		switch {
		case name == "-" || !field.IsExported():
			continue
		case field.Anonymous && name == "" && field.Type.Kind() == reflect.Struct:
			fieldShapes(field.Type, properties)
			continue
		case name == "":
			name = field.Name
		}
		shape := schema{}
		if field.Type != rawJSON {
			if kind := jsonType(field.Type); kind != nil {
				shape["type"] = kind
			}
		}
		properties[name] = shape
	}
}

func outputOf[R any]() schema {
	properties := map[string]schema{}
	fieldShapes(reflect.TypeFor[R](), properties)
	return schema{"type": "object", "properties": properties}
}
