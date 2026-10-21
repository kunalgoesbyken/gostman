# Use from a coding agent

`gostman mcp` serves a workspace over the Model Context Protocol, so Claude Code, Codex, Cursor and other MCP clients can call your APIs through Gostman in place of `curl`.

```bash
gostman init api
claude mcp add gostman -- gostman mcp --workspace api --var-from-env API_TOKEN
```

For other clients, register the command `gostman` with the arguments `mcp --workspace api`.

The agent gets these tools: `list_requests`, `get_request`, `send_request`, `run_folder`, `save_request`, `list_environments`, `set_environment`, `start_mock`, `stop_mock` and `mock_status`.

What this gives you over a shell command:

- **Secrets stay out of the conversation.** Requests reference `{{name}}`; values are filled in inside Gostman and replaced with their names in everything returned, including URL-encoded, base64 and JSON-escaped echoes. Variable values shorter than six characters are not treated as secrets; passwords, tokens and keys in a request's auth settings are, from three characters. This guards against accidental exposure; it is not a barrier against a value the server returns in a transformed form.
- **The agent can only call hosts your collection already uses**, plus localhost. Add more with `--allow-host api.example.com`, or `--allow-host '*'` for any. Requests an agent saves never widen this list.
- **State carries across calls.** Cookies, OAuth 2.0 tokens and variables last for the session.
- **Small answers.** Bodies are capped at 8 KB by default and can be narrowed with a JSONPath.
- **Shared work.** Requests the agent saves are YAML files in the workspace, visible in the app and in Git. An agent cannot save a literal credential.

The OAuth 2.0 authorization code grant and WebSocket requests are not available to agents.

