package main

import (
	"context"

	"github.com/kunalgoesbyken/gostman/engine"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const streamEventName = "sse:messages"

type StreamBatch struct {
	StreamId string                 `json:"streamId"`
	Messages []engine.StreamMessage `json:"messages"`
}

func (a *App) StreamRequest(id string, request engine.Request) engine.Response {
	ctx, cancel := context.WithCancel(a.ctx)
	a.track(id, cancel)
	defer a.release(id)

	return engine.Stream(ctx, request, a.sendPolicy(), func(messages []engine.StreamMessage) {
		wailsruntime.EventsEmit(a.ctx, streamEventName, StreamBatch{StreamId: id, Messages: messages})
	})
}
