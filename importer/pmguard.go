package importer

import "strings"

func nestingDepth(source string) int {
	depth, deepest := 0, 0
	for index := 0; index < len(source); index++ {
		switch source[index] {
		case '(', '[', '{':
			depth++
			deepest = max(deepest, depth)
		case ')', ']', '}':
			depth = max(0, depth-1)
		case '\'', '"', '`':
			index = skipQuoted(source, index)
		case '/':
			index = skipComment(source, index)
		}
	}
	return deepest
}

func skipQuoted(source string, start int) int {
	for index := start + 1; index < len(source); index++ {
		if source[index] == '\\' {
			index++
		} else if source[index] == source[start] {
			return index
		}
	}
	return len(source)
}

func skipComment(source string, start int) int {
	if start+1 >= len(source) {
		return start
	}
	switch source[start+1] {
	case '/':
		if end := strings.IndexByte(source[start:], '\n'); end >= 0 {
			return start + end
		}
		return len(source)
	case '*':
		if end := strings.Index(source[start+2:], "*/"); end >= 0 {
			return start + 3 + end
		}
		return len(source)
	}
	return start
}
