package main

import (
	"context"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mcpclient"
)

func (a *App) DescribeMcp(target mcpclient.Target) (mcpclient.Catalog, error) {
	return mcpclient.Describe(a.ctx, target, a.mcpPolicy())
}

func (a *App) InvokeMcp(id string, call mcpclient.Call) engine.Response {
	ctx, cancel := context.WithCancel(a.ctx)
	a.track(id, cancel)
	defer a.release(id)

	return mcpclient.Invoke(ctx, call, a.mcpPolicy())
}

func (a *App) DiscoverMcpAuthorization(query mcpclient.AuthQuery) mcpclient.AuthPlan {
	return mcpclient.DiscoverAuthorization(a.ctx, query, a.policy())
}

func (a *App) mcpPolicy() engine.Policy {
	policy := a.policy()
	policy.RunCommands = true
	return policy
}
