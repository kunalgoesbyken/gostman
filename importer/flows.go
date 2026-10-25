package importer

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const untitledFlow = "Untitled flow"

func (c *collector) gostmanFlows(raw []json.RawMessage, requests idMap) {
	paths := requestPaths(c.Folders, c.Requests)
	for _, item := range raw {
		var flow workspace.Flow
		if err := json.Unmarshal(item, &flow); err != nil {
			c.skip(messageGostmanItem, "flow")
			continue
		}
		flow.Id = newID()
		flow.Name = cleanName(flow.Name, untitledFlow)
		missing := false
		flow.Steps = namedSteps(linkedSteps(flow.Steps, requests, &missing), paths)
		if missing {
			c.warn(RemarkFlows, fmt.Sprintf(messageFlowRequests, flow.Name))
		}
		c.Flows = append(c.Flows, flow)
	}
}

func linkedSteps(steps []workspace.FlowStep, requests idMap, missing *bool) []workspace.FlowStep {
	linked := make([]workspace.FlowStep, len(steps))
	for index, step := range steps {
		if step.RequestId != "" {
			step.RequestId = requests.resolve(step.RequestId)
			*missing = *missing || (step.RequestId == "" && step.Request == "")
		}
		step.Steps = linkedSteps(step.Steps, requests, missing)
		linked[index] = step
	}
	return linked
}

func requestPaths(folders []workspace.Folder, requests []workspace.Request) map[string]string {
	byId := map[string]workspace.Folder{}
	for _, folder := range folders {
		byId[folder.Id] = folder
	}
	pathOf := func(folderId string) []string {
		var names []string
		seen := map[string]bool{}
		for folder, found := byId[folderId]; found && !seen[folder.Id]; folder, found = byId[folder.ParentId] {
			seen[folder.Id] = true
			names = append([]string{folder.Name}, names...)
		}
		return names
	}
	paths := map[string]string{}
	for _, request := range requests {
		paths[request.Id] = strings.Join(append(pathOf(request.FolderId), request.Name), "/")
	}
	return paths
}

func namedSteps(steps []workspace.FlowStep, paths map[string]string) []workspace.FlowStep {
	named := make([]workspace.FlowStep, len(steps))
	for index, step := range steps {
		if path, found := paths[step.RequestId]; found {
			step.Request = path
		}
		step.Steps = namedSteps(step.Steps, paths)
		named[index] = step
	}
	return named
}
