# AI features (bring your own key)

AI is off by default. Open the command palette, choose "AI settings", tick the consent line, turn AI on, pick a provider, type a model id and paste a key. Use "Test connection" to check it.

Providers: Anthropic, OpenAI, Google Gemini, OpenRouter, Ollama and any OpenAI-compatible base URL. Model ids are typed by you; the placeholders are only hints. Plain `http` base URLs are refused unless the host is loopback or you allow it for that address.

## Where the key lives

- Desktop: the OS keychain through the existing secret store. The page never reads it back; the Go side calls the provider.
- Web: the key stays in this browser (local storage, or session storage when "Remember on this device" is off). The page calls the provider directly. Keys and prompts never pass through Gostman servers or `/api/proxy`.

## Browser limits (CORS)

A provider must allow cross-origin calls from the page. Anthropic is called with its direct-browser-access header; OpenAI, Gemini and OpenRouter allow browsers. A local Ollama needs `OLLAMA_ORIGINS` set to the site. If a provider blocks browsers, use the desktop app.

## What is sent

Every action shows a preview of the exact text before the first send, with a byte and token estimate. Secret variable values, auth fields, sensitive header values and sensitive JSON keys are masked, variables are sent by name only, and response bodies are sent as structure unless you opt in to values. "Don't ask again for this action" skips the preview for that action only.

## What AI can do

Draft a request, assertions and tests, pre and post scripts, a failure explanation, request docs, a collection search, and requests from an API schema. Results are proposals shown as a preview; nothing is sent, saved or run until you accept, and scripts run only when you press Send. In a restricted folder, script generation is disabled and accepted scripts stay inert until the folder is trusted.
