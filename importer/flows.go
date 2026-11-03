package importer

import (
	"encoding/json"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const untitledFlow = "Untitled flow"

func (c *collector) gostmanFlows(raw []json.RawMessage, requests idMap) {
	paths := requestPaths(c.Folders, c.Requests)
	var flows []workspace.Flow
	renamed := idMap{}
	for _, item := range raw {
		var flow workspace.Flow
		if err := json.Unmarshal(item, &flow); err != nil {
			c.skip(locales.ImporterGostmanItemFlow, nil)
			continue
		}
		flow.Id = renamed.fresh(flow.Id)
		flows = append(flows, flow)
	}
	for _, flow := range flows {
		flow.Name = cleanName(flow.Name, untitledFlow)
		var missing unlinked
		flow.Steps = namedSteps(linkedSteps(flow.Steps, requests, renamed, &missing), paths)
		if missing.requests {
			c.warn(RemarkFlows, locales.New(locales.ImporterFlowRequests, locales.Params{"name": flow.Name}))
		}
		if missing.flows {
			c.warn(RemarkFlows, locales.New(locales.ImporterFlowFlows, locales.Params{"name": flow.Name}))
		}
		c.Flows = append(c.Flows, flow)
	}
}

type unlinked struct {
	requests bool
	flows    bool
}

func linkedSteps(steps []workspace.FlowStep, requests, flows idMap, missing *unlinked) []workspace.FlowStep {
	linked := make([]workspace.FlowStep, len(steps))
	for index, step := range steps {
		if step.RequestId != "" {
			step.RequestId = requests.resolve(step.RequestId)
			missing.requests = missing.requests || (step.RequestId == "" && step.Request == "")
		}
		if step.FlowId != "" {
			step.FlowId = flows.resolve(step.FlowId)
			missing.flows = missing.flows || (step.FlowId == "" && step.Flow == "")
		}
		step.Steps = linkedSteps(step.Steps, requests, flows, missing)
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
