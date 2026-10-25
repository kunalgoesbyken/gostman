package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/skills"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	nestedWorkspace  = "gostman"
	skillDirectory   = ".claude/skills/gostman"
	skillFileName    = "SKILL.md"
	skillFilePerm    = 0o644
	skillFolderPerm  = 0o755
	registrationText = `
Claude Code:
  claude mcp add gostman -- gostman mcp --workspace "%[1]s"

Other MCP clients (stdio), in the client's server list:
  {
    "mcpServers": {
      "gostman": {
        "command": "gostman",
        "args": ["mcp", "--workspace", %[2]s]
      }
    }
  }

Keep secrets out of the workspace files: pass them with --var-from-env NAME
and reference them in requests as {{NAME}}.
`
)

type initialization struct {
	folder string
	skill  bool
}

func parseInitialization(arguments []string) (initialization, error) {
	parsed := initialization{folder: currentFolder}
	flags := flag.NewFlagSet("init", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.BoolVar(&parsed.skill, "skill", false, "")
	positional, err := parseInterspersed(flags, arguments)
	switch {
	case err != nil:
		return parsed, err
	case len(positional) > 1:
		return parsed, errors.New("name at most one folder")
	case len(positional) == 1:
		parsed.folder = positional[0]
	}
	return parsed, nil
}

func createWorkspace(root string, stdout io.Writer) error {
	if _, err := workspace.Create(root, workspace.Collection{SharedOrder: true}); err != nil {
		return err
	}
	fmt.Fprintf(stdout, "Created an empty Gostman workspace in %s.\n", root)
	return nil
}

func prepareWorkspace(root string, stdout io.Writer) (string, error) {
	state, err := workspace.Inspect(root)
	if err != nil {
		return "", err
	}
	switch state {
	case workspace.Existing:
		fmt.Fprintf(stdout, "%s is already a Gostman workspace.\n", root)
		return root, nil
	case workspace.Foreign:
		return nestWorkspace(root, stdout)
	}
	return root, createWorkspace(root, stdout)
}

func nestWorkspace(root string, stdout io.Writer) (string, error) {
	nested := filepath.Join(root, nestedWorkspace)
	state, err := workspace.Inspect(nested)
	if err != nil {
		return "", err
	}
	switch state {
	case workspace.Existing:
		fmt.Fprintf(stdout, "%s is already a Gostman workspace.\n", nested)
		return nested, nil
	case workspace.Foreign:
		return "", fmt.Errorf("%s and %s already contain other files; name an empty folder, for example \"gostman init api\"", root, nested)
	}
	fmt.Fprintf(stdout, "%s already holds other files, so the workspace goes in its own folder.\n", root)
	return nested, createWorkspace(nested, stdout)
}

func installSkill(stdout io.Writer) error {
	target, err := filepath.Abs(filepath.Join(filepath.FromSlash(skillDirectory), skillFileName))
	if err != nil {
		return err
	}
	existing, err := os.ReadFile(target)
	switch {
	case err == nil && string(existing) == skills.Gostman:
		fmt.Fprintf(stdout, "The Gostman skill in %s is up to date.\n", target)
		return nil
	case err == nil:
		fmt.Fprintf(stdout, "%s already exists and was left as it is; delete it and run this again to install the current version.\n", target)
		return nil
	case !errors.Is(err, fs.ErrNotExist):
		return err
	}
	if err := os.MkdirAll(filepath.Dir(target), skillFolderPerm); err != nil {
		return err
	}
	if err := os.WriteFile(target, []byte(skills.Gostman), skillFilePerm); err != nil {
		return err
	}
	fmt.Fprintf(stdout, "Installed the Gostman skill for coding agents in %s.\n", target)
	return nil
}

func initCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseInitialization(arguments)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	absolute, err := filepath.Abs(parsed.folder)
	if err != nil {
		return complain(stderr, err)
	}
	root, err := prepareWorkspace(absolute, stdout)
	if err != nil {
		return complain(stderr, err)
	}
	if parsed.skill {
		if err := installSkill(stdout); err != nil {
			return complain(stderr, err)
		}
	}
	quoted, err := json.Marshal(root)
	if err != nil {
		return complain(stderr, err)
	}
	fmt.Fprintf(stdout, registrationText, root, quoted)
	return exitPassed
}
