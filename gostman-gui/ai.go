package main

import (
	"context"
	"errors"
	"strings"

	"github.com/krockxz/gostman/ai"
)

const aiKeyPrefix = "ai:"

type AiReply struct {
	Text  string    `json:"text"`
	Error *ai.Error `json:"error"`
}

func aiKeyName(provider string) string { return aiKeyPrefix + provider }

func (a *App) AiKeyStored(provider string) bool {
	_, stored := vault.get(aiKeyName(provider))
	return stored
}

func (a *App) AiSaveKey(provider, key string) error {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return errors.New("paste a key first")
	}
	return vault.set(aiKeyName(provider), trimmed)
}

func (a *App) AiRemoveKey(provider string) error {
	return vault.remove(aiKeyName(provider))
}

func (a *App) AiPreview(provider string, prompt ai.Prompt, secrets []string) ai.Prompt {
	key, _ := vault.get(aiKeyName(provider))
	return ai.Scrub(prompt, append(secrets, key))
}

func (a *App) AiComplete(id string, config ai.Config, prompt ai.Prompt, secrets []string, maxTokens int) AiReply {
	ctx, cancel := context.WithCancel(a.ctx)
	a.track(id, cancel)
	defer a.release(id)
	key, _ := vault.get(aiKeyName(config.Provider))
	text, err := ai.Run(ctx, config, key, prompt, secrets, maxTokens)
	return replyOf(text, err)
}

func (a *App) AiCheck(id string, config ai.Config) AiReply {
	ctx, cancel := context.WithCancel(a.ctx)
	a.track(id, cancel)
	defer a.release(id)
	key, _ := vault.get(aiKeyName(config.Provider))
	return replyOf("", ai.Check(ctx, config, key))
}

func (a *App) AiCancel(id string) {
	a.CancelRequest(id)
}

func replyOf(text string, err error) AiReply {
	if err == nil {
		return AiReply{Text: text}
	}
	var failed *ai.Error
	if errors.As(err, &failed) {
		return AiReply{Error: failed}
	}
	return AiReply{Error: &ai.Error{Kind: ai.KindNetwork, Message: err.Error()}}
}
