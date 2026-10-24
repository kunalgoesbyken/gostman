import { DOCS_URL } from "../lib/siteLinks"

export const guidePages = [
  {
    path: "postman-alternative",
    title: "A Postman alternative with no account | Gostman",
    description: "Gostman is a free, open source API client for REST, GraphQL, gRPC and WebSocket. No account, collections are YAML files you can commit, and it runs in the browser or as a desktop app.",
    heading: "A Postman alternative with no account",
    intro: "Gostman is a free, open source API client for REST, GraphQL, gRPC and WebSocket. It runs in the browser and as a desktop app, needs no account, and keeps collections as plain YAML files you can commit next to your code.",
    sections: [
      {
        heading: "What is included without signing in",
        items: [
          "Collections as one YAML file per request in a folder, with a Git panel on the desktop",
          "Assertions, pre-request and post-response scripts, and a collection runner with CSV or JSON data files",
          "HTML, JUnit and JSON reports, and a command line for CI",
          "A local mock server and traffic capture",
          "An MCP server so a coding agent can use the same collection",
        ],
      },
      {
        heading: "Moving over from Postman",
        brands: ["postman", "openapi", "insomnia", "bruno"],
        paragraphs: [
          "Import a Postman collection, or OpenAPI, Insomnia, HAR, WSDL, Bruno, .http files and curl. Collections export back to Postman, OpenAPI, HAR, Bruno, .http files and Markdown.",
          "Imported scripts are kept and listed in the import summary. Gostman scripts use test() and expect() rather than the Postman pm API, so review them after importing.",
        ],
      },
      {
        heading: "What Gostman does not do",
        items: [
          "No hosted collaboration, single sign-on or cloud monitors, because there are no accounts",
          "Builds are not code-signed yet, so Windows and macOS ask for confirmation the first time",
          "The browser version relays requests through a small proxy and cannot reach localhost; use the desktop app for local APIs",
        ],
      },
      {
        heading: "Prices and plans",
        paragraphs: ["Postman and Bruno change their plans, so check their own pricing pages before you decide."],
        links: [
          { label: "Postman pricing", href: "https://www.postman.com/pricing/", brand: "postman" },
          { label: "Bruno pricing", href: "https://www.usebruno.com/pricing", brand: "bruno" },
        ],
      },
    ],
  },
  {
    path: "api-tests-in-ci",
    title: "Run API tests in CI from a collection | Gostman",
    description: "gostman run sends every request in a collection with its scripts and checks, prints what failed, writes JUnit, JSON or HTML reports and exits non-zero so the pipeline stops. One binary, no runtime.",
    heading: "Run API tests in CI from a collection",
    intro: "The same collection you use in the app runs in a pipeline with one command. gostman run sends every request of a folder or export with its scripts, checks, extraction rules, cookies and OAuth 2 tokens, and needs only the single binary.",
    code: "gostman run orders-api --env CI --var-from-env API_TOKEN --reporter junit --output report.xml",
    sections: [
      {
        heading: "What the run gives you",
        brands: ["github-actions", "docker", "gitlab"],
        items: [
          "Exit code 0 when every request and check passed, 1 when one failed, 2 when the command or input is wrong",
          "Text, JSON, JUnit and HTML reports",
          "Data-driven runs from a CSV or JSON file, and parallel runs",
          "Secrets passed from the job environment, with --redact to keep values out of reports",
          "A GitHub Action and a Docker image, with recipes for GitLab CI and Jenkins",
        ],
      },
      {
        heading: "Starting from a Postman collection",
        paragraphs: ["Import the collection in the app, save it to a folder, and point gostman run at that folder. Imported scripts are kept and flagged in the import summary, and Gostman scripts use test() and expect()."],
      },
    ],
    links: [{ label: "CI recipes", href: `${DOCS_URL}/ci.md` }, { label: "Command line reference", href: `${DOCS_URL}/cli.md` }],
  },
  {
    path: "api-client-mcp-server",
    title: "An API client your coding agent can use over MCP | Gostman",
    description: "gostman mcp lets Claude Code, Codex and Cursor call your API through the collection you already have, with credentials replaced by their variable names in everything the agent reads.",
    heading: "An API client your coding agent can use over MCP",
    intro: "Claude Code, Codex and Cursor can call Gostman through MCP in place of improvised curl commands. They use the collection you already have, so requests, variables and environments are the ones your team reviewed.",
    code: "gostman mcp",
    brands: ["claude", "openai", "cursor"],
    sections: [
      {
        heading: "How secrets are handled",
        items: [
          "Requests use {{name}} placeholders; values are filled in inside Gostman",
          "In everything the agent reads, variable values and credentials are replaced with their names",
          "Agents can reach localhost, hosts your collection already uses and hosts you allow explicitly",
          "Responses are capped and can be narrowed to the fields that matter",
        ],
      },
      {
        heading: "Limits",
        paragraphs: ["This guards against accidental leaks. It does not protect against a server that echoes a secret back in a transformed form."],
      },
    ],
    links: [{ label: "Use Gostman from a coding agent", href: `${DOCS_URL}/agents.md` }],
  },
]
