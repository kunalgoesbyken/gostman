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

const aiKeyBindingSuffix = ":base"

const aiKeyMoved = "This key was saved for a different address. Save it again for this base URL."

func aiKeyName(provider string) string { return aiKeyPrefix + provider }

func aiKeyBindingName(provider string) string { return aiKeyName(provider) + aiKeyBindingSuffix }

func boundAiKey(config ai.Config) (string, *ai.Error) {
	base, problem := ai.ResolveBase(config)
	if problem != nil {
		return "", problem
	}
	key, stored := vault.get(aiKeyName(config.Provider))
	if !stored {
		return "", nil
	}
	if bound, _ := vault.get(aiKeyBindingName(config.Provider)); bound != base {
		return "", &ai.Error{Kind: ai.KindConfig, Message: aiKeyMoved}
	}
	return key, nil
}

func (a *App) AiKeyStored(provider string) bool {
	_, stored := vault.get(aiKeyName(provider))
	return stored
}

func (a *App) AiSaveKey(config ai.Config, key string) error {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return errors.New("paste a key first")
	}
	base, problem := ai.ResolveBase(config)
	if problem != nil {
		return errors.New(problem.Message)
	}
	if err := vault.set(aiKeyName(config.Provider), trimmed); err != nil {
		return err
	}
	return vault.set(aiKeyBindingName(config.Provider), base)
}

func (a *App) AiRemoveKey(provider string) error {
	if err := vault.remove(aiKeyBindingName(provider)); err != nil {
		return err
	}
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
	key, problem := boundAiKey(config)
	if problem != nil {
		return AiReply{Error: problem}
	}
	text, err := ai.Run(ctx, config, key, prompt, secrets, maxTokens)
	return replyOf(text, err)
}

func (a *App) AiCheck(id string, config ai.Config) AiReply {
	ctx, cancel := context.WithCancel(a.ctx)
	a.track(id, cancel)
	defer a.release(id)
	key, problem := boundAiKey(config)
	if problem != nil {
		return AiReply{Error: problem}
	}
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
