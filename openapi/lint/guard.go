package lint

import "fmt"

const (
	maxDepth = 200
	maxNodes = 2_000_000
)

type guard struct {
	nodes int
}

func checkLimits(root map[string]any) error {
	return (&guard{}).visit(root, 0)
}

func (g *guard) visit(value any, depth int) error {
	if depth > maxDepth {
		return fmt.Errorf("the document is nested more than %d levels deep", maxDepth)
	}
	g.nodes++
	if g.nodes > maxNodes {
		return fmt.Errorf("the document has more than %d values", maxNodes)
	}
	switch typed := value.(type) {
	case map[string]any:
		return g.visitMap(typed, depth)
	case []any:
		return g.visitList(typed, depth)
	}
	return nil
}

func (g *guard) visitMap(items map[string]any, depth int) error {
	for _, item := range items {
		if err := g.visit(item, depth+1); err != nil {
			return err
		}
	}
	return nil
}

func (g *guard) visitList(items []any, depth int) error {
	for _, item := range items {
		if err := g.visit(item, depth+1); err != nil {
			return err
		}
	}
	return nil
}
