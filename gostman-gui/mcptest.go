package main

import (
	"context"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/mcpclient"
)

func (a *App) DescribeMcp(target mcpclient.Target) (mcpclient.Catalog, error) {
	return mcpclient.Describe(a.ctx, target, a.policy())
}

func (a *App) InvokeMcp(id string, call mcpclient.Call) engine.Response {
	ctx, cancel := context.WithCancel(a.ctx)
	a.track(id, cancel)
	defer a.release(id)

	return mcpclient.Invoke(ctx, call, a.policy())
}
