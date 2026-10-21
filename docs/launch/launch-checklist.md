# Launch checklist

## Before posting

- [ ] Benchmark finished; replace every "[benchmark results pending]" in show-hn.md and comparison.md, or delete the lines.
- [ ] Resolve every "TODO verify" in comparison.md, reddit.md and show-hn.md.
- [ ] Fix or explain the go.mod module path (github.com/krockxz/gostman) vs the repo (kunalgoesbyken/gostman); someone will notice.
- [ ] Check that tests exist publicly or be ready to answer "where are the tests" (AGENTS.md says test files are not committed).
- [ ] Clean-machine install test of the Windows installer, macOS dmg and Linux deb, including the SmartScreen and Gatekeeper steps in the README.
- [ ] Verify the `claude mcp add gostman -- gostman mcp --workspace api` flow from a fresh install in under two minutes.
- [ ] Confirm the web version (gostman.vercel.app) loads and the proxy is healthy; consider rate-limit headroom for a traffic spike.
- [ ] Open issues templates and a "good first issue" label ready; enable GitHub Discussions if wanted.
- [ ] Read the rules of r/golang, r/selfhosted, r/programming (self-promotion limits, required flair, account age).

## README top-of-page changes

- [ ] Replace the one-line description with the agent+CI angle first, for example: "An API client that you, your CI pipeline and your coding agent share."
- [ ] Put the demo GIF directly under the title, above the screenshot table.
- [ ] Add a three-line quickstart right after the GIF: `gostman init api`, `claude mcp add gostman -- gostman mcp --workspace api`, `gostman run api --reporter junit`.
- [ ] Move "Use from a coding agent" higher (before the long Features list) and link to it from the intro.
- [ ] Move the unsigned-build note and web-proxy limits near Install (already there; keep them visible).
- [ ] Add a short "Limitations" section (unsigned, no team features, young project) so the honesty is in the repo, not only in the post.
- [ ] Link comparison.md only after TODOs are resolved.

## Demo GIF storyboard (about 40 seconds, no audio, captions on screen)

| Time | Scene | Caption |
| --- | --- | --- |
| 0-5 s | Gostman app with a collection of 4 requests; folder open, YAML visible in an editor split | "A collection is a folder of YAML files" |
| 5-10 s | Terminal: `gostman init api` then `claude mcp add gostman -- gostman mcp --workspace api --var-from-env API_TOKEN` | "Register it with your coding agent" |
| 10-22 s | Claude Code prompt: "Create a user and check the new user's id". Agent calls `list_requests`, then `send_request`; result shows `Authorization: Bearer {{token}}` not the value | "The agent uses saved requests. Secrets stay as {{token}}" |
| 22-28 s | Agent saves a new request with `save_request`; the app shows it appear in the folder, `git status` lists the new YAML | "What the agent saves is a reviewable file" |
| 28-36 s | Terminal: `gostman run api --env CI --reporter junit`, one check fails, exit code 1 printed | "The same collection runs in CI" |
| 36-40 s | End card: repo URL, "MIT. No account." | "github.com/kunalgoesbyken/gostman" |

Capture tips: 1280x720, under 10 MB for GitHub, also export an MP4 for Product Hunt and a poster frame. Use a throwaway API token and a public test API.

## When to post

- Show HN: weekday, around 8-10 am US Eastern (Tuesday to Thursday are common choices). Post once; do not ask for upvotes. Unverified rule of thumb, not a guarantee.
- Product Hunt: launches reset at 12:01 am Pacific; schedule for a Tuesday to Thursday and be ready from midnight. TODO verify current Product Hunt rules on scheduling and pre-launch pages.
- Reddit: stagger across days, not the same hour as Show HN. Weekday mornings US time.
- Do not launch all channels on the same day; the first one gives you bugs to fix for the next.

## Being online

- [ ] Block 6-8 hours after the post with no meetings; first two hours matter most for Show HN comments.
- [ ] Have the repo open to fix typos and README issues immediately; have `gh release` ready for a hotfix.
- [ ] Answer every comment, including harsh ones; concede real limits (unsigned builds, no team features) quickly and without defensiveness.
- [ ] Keep a running list of feature requests and bugs raised; open issues as you go.
- [ ] Do not edit a post to hype after criticism; add a calm update instead.
- [ ] Day 2: follow up on every thread, thank people, ship at least one visible fix and mention it.
