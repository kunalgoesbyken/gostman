package agent

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
