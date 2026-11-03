package importer

import (
	"encoding/json"
	"slices"
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
		flow.Name = cleanName(flow.Name, untitledFlow)
		flows = append(flows, flow)
	}
	links := flowLinks{requests: requests, flows: renamed, names: flowNames(flows)}
	for _, flow := range flows {
		var missing unlinked
		flow.Steps = namedSteps(links.linked(flow.Steps, &missing), paths)
		if missing.requests {
			c.warn(RemarkFlows, locales.New(locales.ImporterFlowRequests, locales.Params{"name": flow.Name}))
		}
		if len(missing.flows) > 0 {
			c.warn(RemarkFlows, missingFlows(flow.Name, missing.flows))
		}
		c.Flows = append(c.Flows, flow)
	}
}

type unlinked struct {
	requests bool
	flows    []string
}

type flowLinks struct {
	requests idMap
	flows    idMap
	names    map[string]int
}

func flowNames(flows []workspace.Flow) map[string]int {
	names := map[string]int{}
	for _, flow := range flows {
		names[flow.Name]++
	}
	return names
}

func (l flowLinks) reachesFlow(step workspace.FlowStep) bool {
	return step.FlowId != "" || l.names[step.Flow] == 1
}

func (l flowLinks) linked(steps []workspace.FlowStep, missing *unlinked) []workspace.FlowStep {
	linked := make([]workspace.FlowStep, len(steps))
	for index, step := range steps {
		if step.RequestId != "" {
			step.RequestId = l.requests.resolve(step.RequestId)
			missing.requests = missing.requests || (step.RequestId == "" && step.Request == "")
		}
		if step.FlowId != "" || step.Flow != "" {
			step.FlowId = l.flows.resolve(step.FlowId)
			if !l.reachesFlow(step) {
				missing.flows = append(missing.flows, step.Flow)
			}
		}
		step.Steps = l.linked(step.Steps, missing)
		linked[index] = step
	}
	return linked
}

func missingFlows(name string, references []string) locales.Message {
	var named []string
	for _, reference := range references {
		if reference != "" && !slices.Contains(named, reference) {
			named = append(named, reference)
		}
	}
	if len(named) == 0 {
		return locales.New(locales.ImporterFlowFlows, locales.Params{"name": name})
	}
	return locales.New(locales.ImporterFlowFlowsNamed, locales.Params{"name": name, "names": listNames(named), "count": len(named)})
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
