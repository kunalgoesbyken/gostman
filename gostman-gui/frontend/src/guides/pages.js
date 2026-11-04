import { docPath } from "../docs/manifest.js"

const POSTMAN_SCRIPTS_ON_IMPORT = "Common pm.* script calls are rewritten to Gostman's script API on import, and the import summary lists the lines that need rewriting by hand."

const WEB_APP_REACH = "The web app sends requests through a hosted proxy, which cannot reach localhost or private addresses. For local servers, use the desktop app or run gostman relay on your computer."

const sameCollectionSection = (...notes) => ({
  heading: "One tool for every protocol",
  paragraphs: ["The request is saved in the same collection as your REST calls, with the same variables, environments and auth, and runs in the collection runner and in gostman run.", ...notes],
})

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
          POSTMAN_SCRIPTS_ON_IMPORT,
        ],
      },
      {
        heading: "What Gostman does not do",
        items: [
          "No hosted collaboration, single sign-on or cloud monitors, because there are no accounts",
          "Builds are not code-signed yet, so Windows and macOS ask for confirmation the first time",
          "The browser version relays requests through a hosted proxy that cannot reach localhost; for local APIs, run gostman relay on your computer or use the desktop app",
        ],
      },
      {
        heading: "Prices and plans",
        paragraphs: ["Postman, Bruno and Insomnia change their plans, so check their own pricing pages before you decide."],
        links: [
          { label: "Postman pricing", href: "https://www.postman.com/pricing/", brand: "postman" },
          { label: "Bruno pricing", href: "https://www.usebruno.com/pricing", brand: "bruno" },
          { label: "Insomnia pricing", href: "https://insomnia.rest/pricing", brand: "insomnia" },
        ],
      },
    ],
    links: [{ label: "Coming from Postman", href: docPath("coming-from-postman") }, { label: "Gostman vs Postman", href: docPath("gostman-vs-postman") }],
  },
  {
    path: "api-tests-in-ci",
    title: "Run API tests in CI: a Newman alternative | Gostman",
    description: "gostman run sends every request in a collection with its scripts and checks, prints what failed, writes JUnit, JSON or HTML reports and exits non-zero so the pipeline stops. A Newman alternative in one binary, with no Node.js.",
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
        paragraphs: ["If you run Postman collections with Newman today, import the collection in the app, save it to a folder, and point gostman run at that folder. The pipeline then needs only the gostman binary, not Node.js and npm.", POSTMAN_SCRIPTS_ON_IMPORT],
      },
    ],
    links: [{ label: "CI recipes", href: docPath("ci") }, { label: "Command line reference", href: docPath("cli") }],
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
    links: [{ label: "Use Gostman from a coding agent", href: docPath("agents") }],
  },
  {
    path: "bruno-alternative",
    title: "Bruno alternative: free, Git-friendly API client | Gostman",
    description: "Gostman keeps collections as plain files in Git like Bruno, with every feature free: Git commit and push, data-driven runs, secret managers and reports. Runs your Bruno folder as it is.",
    heading: "A Bruno alternative with every feature free",
    intro: "Bruno and Gostman share an idea: a collection is a folder of plain files that you commit with your code, and neither needs an account. Gostman keeps that workflow and puts everything in the free download, adds a web app, and runs from one binary in CI.",
    code: "gostman run ./my-bruno-collection --env CI",
    brands: ["bruno", "github", "docker"],
    sections: [
      {
        heading: "What Gostman adds",
        items: [
          "Git commit, push, branches, stash and conflict resolution in the desktop app, with no paid plan",
          "Data-driven runs, HTML, JUnit and JSON reports, and secret managers such as Vault, AWS, Azure, Google Cloud, 1Password and Bitwarden, all free",
          "A web app that needs no install and no sign-in",
          "A single gostman binary for CI, with no Node.js runtime",
          "MQTT, Socket.IO and MCP requests next to REST, GraphQL, gRPC, WebSocket, SOAP and Server-Sent Events",
          "A load test, a secret scanner and an MCP server for coding agents",
        ],
      },
      {
        heading: "Moving over from Bruno",
        paragraphs: [
          "gostman run reads a Bruno collection folder directly, so you can try your existing tests before you convert anything. The app imports Bruno folders and exports back to Bruno.",
          "bru.* script calls are rewritten to Gostman's script API on import, and the import summary lists anything that needs a manual change.",
        ],
      },
      {
        heading: "Where Bruno may suit you better",
        items: [
          "Bruno has a VS Code extension and a larger documentation set",
          "Bruno offers paid support and licence management for companies that need them",
        ],
      },
    ],
    links: [{ label: "Gostman vs Bruno", href: docPath("gostman-vs-bruno") }, { label: "Coming from Bruno", href: docPath("coming-from-bruno") }],
  },
  {
    path: "insomnia-alternative",
    title: "Insomnia alternative with no account | Gostman",
    description: "Gostman is an open source Insomnia alternative for REST, GraphQL, gRPC and WebSocket. No account, collections as YAML files in Git, and a free mock server, runner and secret managers.",
    heading: "An Insomnia alternative with no account",
    intro: "Gostman covers the requests you send from Insomnia, REST, GraphQL, gRPC and WebSocket, without an account at any level. Collections are YAML files in a folder you choose, so Git is the sync, and nothing waits behind an Enterprise plan.",
    brands: ["insomnia", "openapi", "github"],
    sections: [
      {
        heading: "What is free in Gostman",
        items: [
          "A local mock server with no monthly request limit, and traffic capture",
          "The collection runner, a load test and a secret scanner",
          "Secret managers: HashiCorp Vault, AWS, Azure, Google Cloud, KeePassXC, 1Password and Bitwarden",
          "A Git panel in the desktop app, with no limit on users",
          "A web app that works without signing in",
        ],
      },
      {
        heading: "Moving over from Insomnia",
        brands: ["insomnia", "postman", "openapi"],
        paragraphs: [
          "Import an Insomnia export, and its environments are scoped to the collection they came from. insomnia.* script calls are rewritten on import, and the import summary lists anything that needs a manual change.",
        ],
      },
      {
        heading: "Where Insomnia may suit you better",
        items: [
          "Designing an API against an OpenAPI spec in the same tool",
          "Live cloud sync with organizations, roles, SSO and SCIM",
          "Teams that already use Kong",
        ],
      },
    ],
    links: [{ label: "Gostman vs Insomnia", href: docPath("gostman-vs-insomnia") }, { label: "Coming from Insomnia", href: docPath("coming-from-insomnia") }],
  },
  {
    path: "thunder-client-alternative",
    title: "Thunder Client alternative for VS Code, free | Gostman",
    description: "Gostman is a free, open source Thunder Client alternative: send requests from VS Code, keep collections as YAML files in Git, and run them in CI. No account and no paid tier.",
    heading: "A Thunder Client alternative with nothing behind a paid plan",
    intro: "Gostman sends requests from VS Code like Thunder Client, and keeps the collection as one YAML file per request in your repository, so Git is the sync. The same folder opens in the desktop app and the web app and runs in CI, and every feature is in the free download.",
    code: "ext install Gostman.gostman",
    brands: ["vscode", "github", "github-actions"],
    sections: [
      {
        heading: "What you get without paying",
        items: [
          "A Send lens above each request file in VS Code, the collection in the Test Explorer and an environment picker in the status bar",
          "Collections saved in your workspace as plain YAML, with no limit on requests or collections",
          "Assertions, pre-request and post-response scripts, and a collection runner with CSV or JSON data files",
          "gostman run for CI, with JUnit, JSON and HTML reports",
          "A desktop app and a web app for when you are not in the editor, plus a mock server and an MCP server for coding agents",
        ],
      },
      {
        heading: "Moving over from Thunder Client",
        paragraphs: [
          "Export the collection and its environments from Thunder Client and import the files together. Requests, folders and environments come across, and the tests res-code, res-body, res-header and json-query become assertion rows. Other test types and unsupported auth are named in the import summary.",
        ],
      },
      {
        heading: "Where Thunder Client may suit you better",
        items: [
          "A request editor that opens inside VS Code itself; Gostman's extension sends saved requests and shows results, and editing happens in the file or the app",
          "Teams that already pay for Thunder Client and use its team features",
        ],
        links: [{ label: "Thunder Client pricing", href: "https://www.thunderclient.com/pricing" }],
      },
    ],
    links: [{ label: "VS Code extension", href: docPath("vscode") }, { label: "Importing other tools", href: docPath("import-export-and-specs") }],
  },
  {
    path: "hoppscotch-alternative",
    title: "Hoppscotch alternative: open source, no sign-in | Gostman",
    description: "Gostman is an open source Hoppscotch alternative for REST, GraphQL, gRPC, WebSocket and MCP. Collections are YAML files in Git, with a CLI for CI, a mock server and no account to sync.",
    heading: "A Hoppscotch alternative that keeps collections in Git",
    intro: "Hoppscotch and Gostman are both open source and both run in the browser. Gostman keeps a collection as a folder of YAML files that you commit with your code, so a team shares requests through pull requests rather than a hosted workspace, and the same folder runs in CI.",
    brands: ["hoppscotch", "github", "docker"],
    sections: [
      {
        heading: "What Gostman adds",
        items: [
          "Collections as one YAML file per request, with a Git panel in the desktop app",
          "gRPC with server reflection or .proto files, and MCP servers, next to REST, GraphQL and WebSocket",
          "A single gostman binary that runs a collection in CI with JUnit, JSON and HTML reports",
          "A local mock server, traffic capture, a load test and a secret scanner",
          "Secret managers such as Vault, AWS, Azure, Google Cloud, 1Password and Bitwarden",
          "An MCP server so a coding agent can use the same collection",
        ],
      },
      {
        heading: "Moving over from Hoppscotch",
        paragraphs: [
          "Export your collections and environments from Hoppscotch and import them together. Nested folders come across, <<name>> becomes {{name}}, and collection headers and auth become folder settings. pw.* scripts are kept as written and need rewriting, and the import summary lists them.",
        ],
      },
      {
        heading: "Where Hoppscotch may suit you better",
        items: [
          "Live team workspaces that sync through a server, hosted or self-hosted",
          "Signing in to see the same collections on every device without Git",
        ],
        links: [{ label: "Hoppscotch pricing", href: "https://hoppscotch.com/pricing", brand: "hoppscotch" }],
      },
    ],
    links: [{ label: "Importing other tools", href: docPath("import-export-and-specs") }, { label: "Collections and Git", href: docPath("collections-and-git") }],
  },
  {
    path: "yaak-alternative",
    title: "Yaak alternative: free for work, with a web app and CLI | Gostman",
    description: "Gostman is a free, MIT-licensed Yaak alternative for REST, GraphQL, gRPC and WebSocket, with a web app, a CLI for CI, a mock server and collections as YAML files in Git. No licence key.",
    heading: "A Yaak alternative with a web app and a CI runner",
    intro: "Yaak and Gostman are both desktop API clients that keep requests as files you can put in Git. Gostman adds a web app that needs no install, and a command line that runs the same collection in CI. It is MIT licensed with no licence key, at home or at work.",
    code: "gostman run ./collection --env CI --reporter junit --output report.xml",
    brands: ["github", "github-actions", "docker"],
    sections: [
      {
        heading: "What Gostman adds",
        items: [
          "A web app in the browser, with no install and no sign-in",
          "gostman run for CI, with exit codes and JUnit, JSON and HTML reports",
          "Assertions and scripts on every request, and a collection runner with data files",
          "A local mock server, traffic capture, a load test and a secret scanner",
          "MCP requests, and an MCP server so a coding agent can use the same collection",
        ],
      },
      {
        heading: "Moving over from Yaak",
        paragraphs: [
          "Gostman does not read Yaak's own data files yet. Import the OpenAPI spec of the API, or copy each request as curl from Yaak and paste it into Gostman's address bar.",
        ],
      },
      {
        heading: "Where Yaak may suit you better",
        items: [
          "A plugin system for custom auth, template functions and importers",
          "A small native desktop app if you never need a browser version or a CI runner",
        ],
        links: [{ label: "Yaak pricing", href: "https://yaak.app/pricing" }],
      },
    ],
    links: [{ label: "Getting started", href: docPath("getting-started") }, { label: "Command line reference", href: docPath("cli") }],
  },
  {
    path: "online-api-tester",
    title: "Test an API online, free and without sign-up | Gostman",
    description: "Send REST, GraphQL, gRPC and WebSocket requests from your browser. No install, no account. Paste a curl command, add tests, and save collections you can export.",
    heading: "Test an API online, with no sign-up",
    intro: "Open Gostman in your browser and send a request in seconds. Paste a URL or a curl command, add headers, auth and a body, and read the response with timing, headers and cookies. Nothing to install and no account to create.",
    sections: [
      {
        heading: "What you can do in the browser",
        items: [
          "REST requests with JSON, XML, form, multipart and file bodies",
          "GraphQL with a schema browser and query builder, gRPC with server reflection, and WebSocket sessions",
          "Bearer, Basic, API key and OAuth 2 auth",
          "Checks and scripts that run on every send, and a runner for a whole collection",
          "Code snippets generated from the request, and import from Postman, Insomnia, Bruno, OpenAPI, HAR and curl",
        ],
      },
      {
        heading: "Where your data is kept",
        paragraphs: [
          "Collections and environments are kept in your browser, not on a server. The hosted proxy sends your request and returns the answer, and stores neither.",
          WEB_APP_REACH,
        ],
      },
    ],
    links: [{ label: "Getting started", href: docPath("getting-started") }, { label: "Requests and responses", href: docPath("requests-and-responses") }],
  },
  {
    path: "grpc-client",
    title: "gRPC client with a GUI, free and open source | Gostman",
    description: "Call gRPC methods with server reflection or .proto files. Unary and streaming calls, metadata, TLS and client certificates, in a desktop app, the browser and a CLI.",
    heading: "A gRPC client for the desktop and the browser",
    intro: "Choose GRPC, enter grpc://host:port or grpcs://host:port, and load the services through server reflection or your .proto files. Pick a method, start from a generated example message, and send.",
    sections: [
      {
        heading: "What it does",
        items: [
          "Services from server reflection, or from .proto files that Gostman compiles",
          "Unary, server streaming, client streaming and bidirectional methods; streams are collected and shown when they end",
          "JSON messages converted with the protobuf JSON mapping, with variables and dynamic values",
          "Headers sent as metadata, and the status code, header and trailer metadata in the response",
          "Proxy, CA certificates and client certificates in the desktop app and gostman run",
        ],
      },
      sameCollectionSection(WEB_APP_REACH),
    ],
    links: [{ label: "Protocols", href: docPath("protocols") }],
  },
  {
    path: "websocket-client",
    title: "WebSocket client online, with Socket.IO and MQTT | Gostman",
    description: "Connect to WebSocket, Socket.IO and MQTT over WebSocket from your browser or the desktop. Send messages with variables, read a message log, save messages and auto-reconnect.",
    heading: "A WebSocket client with Socket.IO and MQTT",
    intro: "Enter a ws:// or wss:// URL and connect. Send text or JSON, read every message in a log, and keep the messages you send often with the request. In the browser, WebSocket connections go straight from your computer.",
    sections: [
      {
        heading: "What it does",
        items: [
          "Plain WebSocket, Socket.IO 3 and 4 with namespaces and an auth payload, and MQTT 3.1.1 over WebSocket",
          "GraphQL subscriptions with the graphql-transport-ws protocol",
          "Variables and dynamic values such as {{$randomEmail}} filled in when a message is sent",
          "Saved messages, a message log you can clear, and auto-reconnect",
          "Every header on the desktop; the browser can send only Sec-WebSocket-Protocol",
        ],
      },
      sameCollectionSection(),
    ],
    links: [{ label: "Protocols", href: docPath("protocols") }],
  },
  {
    path: "graphql-client",
    title: "GraphQL client online, with schema browser | Gostman",
    description: "Write GraphQL queries with variables, browse the schema, build queries by clicking fields, and run subscriptions over WebSocket or server-sent events. Free, in the browser or the desktop.",
    heading: "A GraphQL client with a schema browser",
    intro: "Choose GRAPHQL, write a query and its variables, and send. Load the schema to browse types and fields, or build a query by picking fields, then add checks so the same query works as a test.",
    sections: [
      {
        heading: "What it does",
        items: [
          "Query and variables editors with {{variables}} from your environment",
          "A schema browser and a query builder",
          "Subscriptions over WebSocket with graphql-transport-ws, or as server-sent events",
          "Headers, Bearer, API key and OAuth 2 auth shared with your REST requests",
          "Checks and scripts on the response, in the app and in CI",
        ],
      },
      sameCollectionSection(WEB_APP_REACH),
    ],
    links: [{ label: "Protocols", href: docPath("protocols") }],
  },
  {
    path: "mcp-client",
    title: "Test MCP servers: a free MCP client and inspector | Gostman",
    description: "Load an MCP server over Streamable HTTP or stdio, call its tools, read resources and get prompts, sign in with OAuth, and add checks that run in CI. Speaks MCP 2026-07-28 and earlier revisions.",
    heading: "Test MCP servers like any other API",
    intro: "Choose MCP and enter the server's URL. Gostman loads its tools, resources, resource templates and prompts, and you call them with JSON arguments. Save the calls in a collection and add checks, so the same tests run in CI.",
    code: "stdio:npx -y @modelcontextprotocol/server-everything",
    brands: ["claude", "openai", "cursor"],
    sections: [
      {
        heading: "What it does",
        items: [
          "Remote servers over Streamable HTTP, and local servers over stdio in the desktop app",
          "Call tool, read resource and get prompt, plus list operations that follow every page",
          "MCP 2026-07-28 and the revisions that start with initialize, back to 2024-11-05",
          "Sign in with OAuth, following the MCP authorization specification step by step",
          "Rule-based checks on tool definitions: missing descriptions, duplicate names and malformed input schemas",
          "A warning when a server's tools change between loads, so new instructions in a description do not slip by",
          "Tool errors count as failures in the collection runner and gostman run",
        ],
      },
      {
        heading: "Local commands are confirmed",
        paragraphs: ["The first time a stdio command runs, Gostman shows it and asks before starting it. The web app, gostman run and agent sessions never start local commands."],
      },
    ],
    links: [{ label: "Protocols", href: docPath("protocols") }, { label: "Use Gostman from a coding agent", href: docPath("agents") }],
  },
  {
    path: "api-client-cli",
    title: "API client CLI: send, test, mock and load test | Gostman",
    description: "One gostman binary sends saved or ad hoc requests, runs collections with checks, serves a mock server, captures traffic, load tests and scans for secrets. A command line Postman alternative.",
    heading: "An API client for the command line",
    intro: "The gostman binary works with the same collections as the app. Send one request and pipe the result, run a whole collection with its checks, or start a mock server, with no runtime to install.",
    code: "gostman send GET https://api.example.com/users --select '$[0].id'",
    brands: ["github-actions", "docker", "gitlab"],
    sections: [
      {
        heading: "Commands",
        items: [
          "send: one saved or ad hoc request; prints only the body, or one value with --select",
          "run and flow run: a collection or a flow with its scripts and checks, with exit codes and reports",
          "mock and capture: a local mock server from saved examples or an OpenAPI spec, and a recording proxy",
          "load, scan and lint: a load test, a secret scanner and an OpenAPI linter",
          "import and export: Postman, Insomnia, Bruno, OpenAPI, HAR and more",
        ],
      },
      {
        heading: "Install",
        paragraphs: [
          "Download the gostman-cli archive for your platform from the releases page, or install it with go install github.com/kunalgoesbyken/gostman/cmd/gostman@latest.",
          "Gostman is a free, open source API client with no account and no paid tier.",
        ],
      },
    ],
    links: [{ label: "Command line reference", href: docPath("cli") }, { label: "CI recipes", href: docPath("ci") }],
  },
]
