package runner

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/kunalgoesbyken/gostman/workspace"
)

func isDirectory(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func isWorkspace(root string) bool {
	state, err := workspace.Inspect(root)
	return err == nil && state == workspace.Existing
}

func loadWorkspace(root string) (Collection, error) {
	state, err := workspace.Inspect(root)
	if err != nil {
		return Collection{}, fmt.Errorf("cannot read the workspace: %w", err)
	}
	if state != workspace.Existing {
		return Collection{}, fmt.Errorf("%s is not a Gostman workspace: it has no %s", root, workspace.ManifestName)
	}
	files, err := workspace.Open(root)
	if err != nil {
		return Collection{}, fmt.Errorf("cannot read the workspace: %w", err)
	}
	problems, flowProblems := splitProblems(files.Problems())
	if len(problems) > 0 {
		return Collection{}, unreadableFiles(problems)
	}
	network, err := files.Network()
	if err != nil {
		return Collection{}, err
	}
	collection, err := FromWorkspace(files.Collection())
	collection.Network, collection.Root = network.Files(), root
	for _, problem := range flowProblems {
		collection.Warnings = append(collection.Warnings, "flow file skipped: "+problem.String())
	}
	return WithFolderFiles(collection, files), err
}

func WithFolderFiles(collection Collection, files *workspace.Workspace) Collection {
	collection.DotEnv = files.DotEnv()
	collection.Modules = scriptModules(files.Root())
	return collection
}

func splitProblems(all []workspace.Problem) ([]workspace.Problem, []workspace.Problem) {
	var requests, flows []workspace.Problem
	for _, problem := range all {
		if workspace.IsFlowFile(problem.Path) {
			flows = append(flows, problem)
			continue
		}
		requests = append(requests, problem)
	}
	return requests, flows
}

func unreadableFiles(problems []workspace.Problem) error {
	lines := make([]string, len(problems))
	for i, problem := range problems {
		lines[i] = "  " + problem.String()
	}
	return fmt.Errorf("these workspace files could not be read, so their requests would be skipped. Fix them and try again:\n%s", strings.Join(lines, "\n"))
}

func FromWorkspace(stored workspace.Collection) (Collection, error) {
	encoded, err := json.Marshal(stored)
	if err != nil {
		return Collection{}, err
	}
	var collection Collection
	return collection, json.Unmarshal(encoded, &collection)
}

func scriptModules(root string) map[string]string {
	modules, err := workspace.ReadScriptModules(root)
	if err != nil {
		return nil
	}
	return modules
}
