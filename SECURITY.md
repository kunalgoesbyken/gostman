# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub: open the [Security tab](https://github.com/kunalgoesbyken/gostman/security) of this repository and choose **Report a vulnerability**. Do not open a public issue, pull request or discussion for a security problem.

Include what you can of the following:

- the part affected: the desktop app, the web app at gostman.com, the hosted relay at `gostman.com/api/proxy`, the `gostman` command line or its MCP server
- the version, from **About Gostman** in the command palette or `gostman version`
- the steps to reproduce it, and what an attacker gains

The report stays private until a fix is released. Credit is given in the advisory unless you ask otherwise.

## Supported versions

Fixes go into the next release. Only the latest release is supported, so update before reporting if you can. The web app at gostman.com always runs the latest code.

## Scope

In scope: anything that lets an attacker read or change a user's requests, variables, secrets, cookies or tokens; run code outside the script sandbox; reach private addresses through the hosted relay; or bypass folder trust, the agent host allowlist or redaction.

Out of scope: scripts in a collection or import you chose to trust doing what they were written to do.
