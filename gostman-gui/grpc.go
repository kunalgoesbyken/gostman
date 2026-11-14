package main

import (
	"context"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/rpc"
)

func (a *App) DescribeGrpc(target rpc.Target) (rpc.Schema, error) {
	return rpc.Describe(a.ctx, target, a.grpcPolicy())
}

func (a *App) InvokeGrpc(id string, call rpc.Call) engine.Response {
	ctx, cancel := context.WithCancel(a.ctx)
	a.track(id, cancel)
	defer a.release(id)

	return rpc.Invoke(ctx, call, a.grpcPolicy())
}

func (a *App) grpcPolicy() engine.Policy {
	policy := a.policy()
	_, isFolder := storage.current().(folderStore)
	policy.ReadFile = workspaceFiles()
	policy.AllowAbsoluteImportRoots = !isFolder
	return policy
}
