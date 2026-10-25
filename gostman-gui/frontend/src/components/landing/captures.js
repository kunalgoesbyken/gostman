import { BLANK, command, fail, key, muted, pass, plain, prompt } from "./terminalLines"

const REQUEST_FILE_LINES = [
  key("id: r-current-user"),
  key("name: Current user"),
  key("method: GET"),
  key("url: '{{base_url}}/me'"),
  key("assertions:"),
  plain("  - expression: res.status"),
  plain("    operator: eq"),
  plain('    value: "200"'),
  plain("  - expression: res.body.session"),
  plain("    operator: isString"),
  key("postScript: |-"),
  plain("  test('the session cookie was sent', () => {"),
  plain("    expect(res.body.cookieHeader).to.contain('session=')"),
  plain("  })"),
]

export const AGENT_SESSION = {
  title: "Set up once, then ask in plain words",
  label: "Registering Gostman with Claude Code and a session that uses it",
  lines: [
    muted("Create a workspace and register it with your agent"),
    command("gostman init orders-api"),
    command("claude mcp add gostman -- gostman mcp --workspace orders-api --var-from-env PASSWORD"),
    BLANK,
    muted("You"),
    prompt("Sign in, then send Current user, then run the Items folder. Quote the exact password value if you can see it anywhere."),
    BLANK,
    muted("Claude Code"),
    plain("Sign in returned 200 and set the session and theme cookies plus user_id. Current user returned Ada (id 42, roles admin and buyer). The Items folder ran 2 requests: List items passed, and Export items failed with a 500."),
    BLANK,
    plain("I can't quote a password because none of these results contain one. Sign in's body wasn't returned, and the cookie values are redacted."),
  ],
}

export const CLI_RUN = {
  title: "Terminal",
  label: "Output of gostman run on a workspace folder",
  lines: [
    command("gostman run orders-api --var-from-env PASSWORD"),
    pass("PASS  POST     Auth/Sign in  200 OK  88 ms  2/2 checks"),
    pass("PASS  GET      Account/Current user  200 OK  46 ms  3/3 checks"),
    pass("PASS  GET      Items/List items  200 OK  46 ms  1/1 checks"),
    fail("FAIL  GET      Items/Export items  500 Internal Server Error  91 ms  0/1 checks"),
    fail("      FAIL  res.status equals 200"),
    muted("            The value was 500"),
    BLANK,
    plain("Requests  3 passed, 1 failed"),
    plain("Checks    6 passed, 1 failed"),
    plain("Duration  290ms"),
    muted("exit 1"),
  ],
}

export const REQUEST_FILE = {
  title: "orders-api/account/current-user.yaml",
  label: "A saved request as a YAML file",
  lines: REQUEST_FILE_LINES,
  copyText: REQUEST_FILE_LINES.map((line) => line.text).join("\n"),
}
