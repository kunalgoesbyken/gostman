package main

import (
	"context"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/rpc"
)

func (a *App) DescribeGrpc(target rpc.Target) (rpc.Schema, error) {
	return rpc.Describe(a.ctx, target, engine.Policy{})
}

func (a *App) InvokeGrpc(id string, call rpc.Call) engine.Response {
	ctx, cancel := context.WithCancel(a.ctx)
	a.track(id, cancel)
	defer a.release(id)

	return rpc.Invoke(ctx, call, engine.Policy{})
}
