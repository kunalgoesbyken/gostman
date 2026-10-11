package main

import (
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/krockxz/gostman/workspace"
)

const registration = `
Claude Code:
  claude mcp add gostman -- gostman mcp --workspace %[1]s

Other MCP clients (stdio), in the client's server list:
  {
    "mcpServers": {
      "gostman": {
        "command": "gostman",
        "args": ["mcp", "--workspace", %[2]q]
      }
    }
  }

Keep secrets out of the workspace files: pass them with --var-from-env NAME
and reference them in requests as {{NAME}}.
`

func initTarget(arguments []string) (string, error) {
	switch len(arguments) {
	case 0:
		return currentFolder, nil
	case 1:
		return arguments[0], nil
	default:
		return "", errors.New("name at most one folder")
	}
}

func prepareWorkspace(root string, stdout io.Writer) error {
	state, err := workspace.Inspect(root)
	if err != nil {
		return err
	}
	switch state {
	case workspace.Existing:
		fmt.Fprintf(stdout, "%s is already a Gostman workspace.\n", root)
		return nil
	case workspace.Foreign:
		return fmt.Errorf("%s already contains files, and a workspace lives in a folder of its own; name a new one, for example \"gostman init api\"", root)
	}
	if _, err := workspace.Create(root, workspace.Collection{}); err != nil {
		return err
	}
	fmt.Fprintf(stdout, "Created an empty Gostman workspace in %s.\n", root)
	return nil
}

func initCommand(arguments []string, stdout, stderr *os.File) int {
	root, err := initTarget(arguments)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	if err := prepareWorkspace(root, stdout); err != nil {
		return complain(stderr, err)
	}
	fmt.Fprintf(stdout, registration, root, root)
	return exitPassed
}
