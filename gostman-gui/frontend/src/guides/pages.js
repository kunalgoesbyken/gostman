import { docPath } from "../docs/manifest.js"

const POSTMAN_SCRIPTS_ON_IMPORT = "Common pm.* script calls are rewritten to Gostman's script API on import, and the import summary lists the lines that need rewriting by hand."

const WEB_APP_REACH = "The web app sends requests through a hosted proxy, which cannot reach localhost or private addresses. For local servers, use the desktop app or run gostman relay on your computer."

const sameCollectionSection = (...notes) => ({
  heading: "One tool for every protocol",
  paragraphs: ["The request is saved in the same collection as your REST calls, with the same variables, environments and auth, and runs in the collection runner and in gostman run.", ...notes],
})

const included = (text) => ({ state: "included", text })
const partial = (text) => ({ state: "partial", text })
const excluded = (text) => ({ state: "excluded", text })

const GOSTMAN = { id: "gostman", name: "Gostman" }
const POSTMAN = { id: "postman", name: "Postman" }
const HOPPSCOTCH = { id: "hoppscotch", name: "Hoppscotch" }

const POSTMAN_WEB = partial("Web app needs sign-in")
const POSTMAN_ACCOUNT = partial("Collections need an account")
const POSTMAN_SOURCE = excluded("Not open source")
const POSTMAN_GIT = included("Native Git, on Free")
const GOSTMAN_WEB = included("Yes, no sign-in")
const GOSTMAN_DESKTOP = included("Windows, macOS and Linux")
const GOSTMAN_ACCOUNT = included("No accounts at all")
const GOSTMAN_SOURCE = included("MIT")
const GOSTMAN_GIT = included("One YAML file per request")
const GOSTMAN_CI = included("gostman run, JUnit reports")

const comparisonOf = (tool, products, rows) => ({
  heading: `How Gostman compares with other ${tool} clients`,
  checked: "November 2026",
  products: [GOSTMAN, ...products],
  rows,
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
    description: "Gostman is a free, open source Yaak alternative for REST, GraphQL, gRPC and WebSocket, with a web app, a CLI for CI, a mock server and collections as YAML files in Git. No licence key.",
    heading: "A Yaak alternative with a web app and a CI runner",
    intro: "Yaak and Gostman are both desktop API clients that keep requests as files you can put in Git. Gostman adds a web app that needs no install, and a command line that runs the same collection in CI. It is open source with no licence key, at home or at work.",
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
    description: "Send REST, GraphQL, gRPC and WebSocket requests from your browser with no install and no account. Paste a curl command, add checks, and save requests you can export.",
    heading: "Test an API online, with no sign-up",
    intro: "Open Gostman in your browser and send a request in seconds. Paste a URL or a curl command, add headers, auth and a body, and read the response with timing, headers and cookies. Nothing to install and no account to create.",
    sections: [
      {
        heading: "Send your first request",
        steps: [
          { title: "Open gostman.com/web.", text: "The web app opens on a request tab. There is no sign-in screen, and nothing is installed." },
          { title: "Paste a URL or a curl command.", text: "A curl command pasted into the address bar fills in the method, URL, headers, body, basic auth, cookies and timeout. Copy as cURL from Chrome, Edge and Firefox pastes as it was copied, in the bash and the Windows form." },
          { title: "Add headers, auth and a body.", text: "Bodies can be JSON, text, XML, SOAP, URL-encoded form, multipart or a file. Auth covers Bearer, Basic, API key and OAuth 2." },
          { title: "Press Send and read the response.", text: "The status, time and size sit above the body. JSON is shown as a tree you can filter with JSONPath, next to the headers, cookies and a timeline of the exchange." },
          { title: "Keep it.", text: "Save the request to a collection, add checks so every send tests the response, or copy it as code for one of 21 targets, from cURL and Python to C#, Swift and PowerShell." },
        ],
        shot: { file: "gostman-gui/frontend/src/assets/landing/rest.webp", alt: "A POST request to {{base_url}}/auth/login with a JSON body, and a 200 OK response with a token and the signed-in user shown as a JSON tree" },
      },
      {
        heading: "What you can do in the browser",
        items: [
          "REST requests with JSON, XML, form, multipart and file bodies",
          "GraphQL with a schema browser and query builder, gRPC with server reflection, WebSocket, Socket.IO and MQTT sessions, and MCP servers",
          "Environments and {{variables}}, with dynamic values such as {{$randomEmail}}",
          "Checks and scripts that run on every send, and a runner for a whole collection with CSV or JSON data files",
          "Import from Postman, Insomnia, Bruno, OpenAPI, HAR and curl, and export back to Postman, OpenAPI, HAR, Bruno and Markdown",
        ],
      },
      {
        heading: "Where your data is kept",
        paragraphs: [
          "Collections and environments are kept in your browser's IndexedDB, not on a server. Clearing the site data for gostman.com deletes them, so export a collection, or use the desktop app or a folder in Git, for anything you want to keep.",
          "Browsers cannot call most APIs directly, so each request goes through a small hosted relay. It sends your request and returns the answer, and stores neither; its code is open source. WebSocket connections go straight from your browser.",
          "Responses larger than 3 MB are cut off in the web app. The desktop app reads up to 50 MB.",
        ],
      },
      {
        heading: "When the API is on your computer",
        paragraphs: [
          WEB_APP_REACH,
          "Start gostman relay and choose it under Preferences, Privacy, and the web app sends through your own computer. The desktop app needs no relay, and adds proxy and certificate settings.",
        ],
      },
    ],
    comparison: comparisonOf("online API", [{ id: "reqbin", name: "ReqBin" }, HOPPSCOTCH, { id: "postman", name: "Postman web" }], [
      { feature: "Send a request with no account", gostman: included("Yes"), reqbin: included("Yes"), hoppscotch: included("Yes, sign-in optional"), postman: excluded("Redirects to sign-in") },
      { feature: "Paste a curl command", gostman: included("Fills method, headers, body and auth"), reqbin: included("Yes"), hoppscotch: included("Yes"), postman: included("Yes") },
      { feature: "Reach localhost from the browser", gostman: partial("Through gostman relay"), reqbin: partial("Needs a Chrome extension"), hoppscotch: partial("Needs its agent, extension or proxy"), postman: partial("Needs the desktop agent") },
      { feature: "Desktop app", gostman: GOSTMAN_DESKTOP, reqbin: excluded("No desktop app"), hoppscotch: included("Yes"), postman: included("Yes") },
      { feature: "Requests as files in Git", gostman: GOSTMAN_GIT, reqbin: excluded("Cloud saves after sign-up"), hoppscotch: partial("JSON export"), postman: POSTMAN_GIT },
      { feature: "Run saved requests in CI", gostman: GOSTMAN_CI, reqbin: excluded("No CLI in its docs"), hoppscotch: partial("hopp test, in alpha"), postman: included("Postman CLI") },
    ]),
    faq: {
      heading: "Questions about testing APIs online",
      entries: [
        { question: "Do I need an account to test an API online?", answer: "No. Gostman has no accounts at all. Open gostman.com/web, paste a URL and press Send." },
        { question: "Is the online API tester free?", answer: "Yes. Gostman is open source and every feature is free, in the browser, the desktop app and the command line." },
        { question: "Can I test a localhost API from the browser?", answer: "Not through the hosted relay, which cannot reach localhost or private addresses. Start gostman relay on your computer and choose it in Preferences, or use the desktop app." },
        { question: "Does the relay store my requests or tokens?", answer: "No. It sends the request and returns the answer and keeps neither. Vercel, which hosts it, keeps standard request logs such as the time, path, status and IP address, but not the request body. If you would rather nothing passed through a third party, use a local relay or the desktop app." },
        { question: "Can I paste a curl command?", answer: "Yes. Paste it into the address bar and Gostman fills in the method, URL, headers, body, basic auth, cookies and timeout. Options with no counterpart, such as -o, are ignored." },
        { question: "Can I keep the requests I make?", answer: "Yes. Save them to a collection in the browser, export the collection, or open the same requests in the desktop app as YAML files you commit to Git." },
      ],
    },
    links: [
      { label: "Getting started", href: docPath("getting-started") },
      { label: "Requests and responses", href: docPath("requests-and-responses") },
      { label: "Local relay for the web app", href: `${docPath("cli")}#local-relay-for-the-web-app` },
    ],
  },
  {
    path: "grpc-client",
    title: "gRPC client with a GUI, free and open source | Gostman",
    description: "A gRPC client for the desktop and the browser. Call methods with server reflection or .proto files, unary and streaming, with metadata and TLS, and run the same calls as tests in CI.",
    heading: "A gRPC client for the desktop and the browser",
    intro: "Choose GRPC, enter grpc://host:port or grpcs://host:port, and load the services through server reflection or your .proto files. Pick a method, start from a generated example message, and send. The same request runs as a test in CI.",
    sections: [
      {
        heading: "Call a gRPC method",
        steps: [
          { title: "Enter the address.", text: "Use grpc://host:port for plaintext and grpcs://host:port for TLS. A bare host:port is plaintext, except on port 443, which uses TLS." },
          { title: "Load the services.", text: "Select Load to ask the server through reflection, or Add .proto files or Add folder when the server has reflection turned off. Gostman compiles the files and lists their services." },
          { title: "Pick a method.", text: "Methods are grouped by service, and a label shows whether it is unary, server streaming, client streaming or bidirectional. Use example fills in a message built from the method's input type." },
          { title: "Send and read the reply.", text: "The status shows the gRPC code and its name, such as 0 OK. The response headers list the header and trailer metadata, grpc-status and grpc-message." },
        ],
        shot: { file: "gostman-gui/frontend/src/assets/landing/grpc.webp", alt: "A gRPC request with the source set to Server reflection, the method storefront.v1.Catalog/GetProduct, a JSON message and a 0 OK response" },
      },
      {
        heading: "What it does",
        items: [
          "Services from server reflection, or from .proto files and whole folders that Gostman compiles",
          "Unary, server streaming, client streaming and bidirectional methods",
          "JSON messages converted with the protobuf JSON mapping, with {{variables}} and dynamic values",
          "Headers sent as metadata, with header and trailer metadata in the response",
          "gRPC over HTTP/2, gRPC-Web, gRPC-Web text and Connect transports",
          "Proxy, CA certificates and client certificates in the desktop app and gostman run",
        ],
      },
      {
        heading: "Without server reflection",
        paragraphs: [
          "Add folder adds every .proto file in a folder and keeps each file's path inside it, like grpcurl -import-path, so two files called status.proto in different folders stay distinct and imports resolve without reflection. The files are saved with the request.",
          "In a folder workspace and the command line, Import roots point at directories in your repository instead, such as proto and vendor/googleapis, and can be set once for a whole folder or collection. The web app keeps an uploaded copy of a Protobuf folder in the collection settings.",
        ],
      },
      {
        heading: "Streams are collected",
        paragraphs: [
          "Gostman does not hold a stream open for you to type into. For a method that reads a stream from the client, write a JSON array and every message is sent up front. For a server stream, the response is a JSON array of every message received, shown when the stream ends. That makes streaming calls repeatable, so they can be checked in a test like any other request.",
        ],
      },
      sameCollectionSection(WEB_APP_REACH, "gRPC-Web and Connect are plain HTTP POST requests, so they also work through HTTP proxies. gRPC-Web needs the .proto files, because it cannot use reflection."),
    ],
    comparison: comparisonOf("gRPC", [{ id: "grpcurl", name: "grpcurl" }, POSTMAN, { id: "kreya", name: "Kreya" }], [
      { feature: "In the browser, no install", gostman: GOSTMAN_WEB, grpcurl: excluded("Command line only"), postman: POSTMAN_WEB, kreya: excluded("Desktop only") },
      { feature: "Desktop app", gostman: GOSTMAN_DESKTOP, grpcurl: excluded("Command line only"), postman: included("Yes"), kreya: included("Yes") },
      { feature: "Works without an account", gostman: GOSTMAN_ACCOUNT, grpcurl: included("Yes"), postman: POSTMAN_ACCOUNT, kreya: included("Account only for paid plans") },
      { feature: "Open source", gostman: GOSTMAN_SOURCE, grpcurl: included("MIT"), postman: POSTMAN_SOURCE, kreya: excluded("Not open source") },
      { feature: "Server reflection and .proto files", gostman: included("Both, and whole folders"), grpcurl: included("Both, and protosets"), postman: included("Both"), kreya: included("Both") },
      { feature: "Streaming methods", gostman: partial("All four kinds, collected, not interactive"), grpcurl: included("All four kinds"), postman: included("All four kinds"), kreya: included("All four kinds") },
      { feature: "Requests as files in Git", gostman: GOSTMAN_GIT, grpcurl: excluded("No saved requests"), postman: POSTMAN_GIT, kreya: included("Git-friendly files") },
      { feature: "Run saved calls in CI", gostman: GOSTMAN_CI, grpcurl: partial("Scriptable, no saved requests"), postman: partial("gRPC runs need a paid plan"), kreya: partial("Tests and collections on Pro") },
    ]),
    faq: {
      heading: "Questions about the gRPC client",
      entries: [
        { question: "Can I call a gRPC API from the browser?", answer: "Yes. The web app at gostman.com/web calls gRPC servers through its hosted relay, with reflection or .proto files. The relay cannot reach localhost or private addresses, so use the desktop app or gostman relay for those." },
        { question: "Does it work when server reflection is turned off?", answer: "Yes. Add the .proto files, or a whole folder of them, and Gostman compiles them and lists the services. Imports resolve by path inside the folder." },
        { question: "Does Gostman support bidirectional streaming?", answer: "Yes, as a collected call: the messages you write as a JSON array are sent up front, and the replies are shown together when the stream ends. Interactive streams, where you type the next message after reading a reply, are not supported." },
        { question: "How do I send auth tokens and metadata?", answer: "Request headers are sent as gRPC metadata, with keys lower-cased, and the Auth tab adds Bearer, Basic or API key auth as it does for HTTP." },
        { question: "Can I run gRPC calls in CI?", answer: "Yes. Save the call in a collection, add checks, and gostman run sends it with every other request and writes JUnit, JSON or HTML reports." },
        { question: "Is it free?", answer: "Yes. Gostman is open source with no account and no paid tier." },
      ],
    },
    links: [
      { label: "gRPC in the docs", href: `${docPath("protocols")}#grpc` },
      { label: "Network settings and client certificates", href: `${docPath("secrets-and-network")}#network-settings` },
      { label: "Command line reference", href: docPath("cli") },
    ],
  },
  {
    path: "websocket-client",
    title: "WebSocket client online, with Socket.IO and MQTT | Gostman",
    description: "An online WebSocket client that also speaks Socket.IO, MQTT over WebSocket, SignalR and GraphQL subscriptions. Send messages with variables, read a message log, save messages and auto-reconnect.",
    heading: "A WebSocket client with Socket.IO and MQTT",
    intro: "Enter a ws:// or wss:// URL and connect. Send text or JSON, read every message in a log, and keep the messages you send often with the request. In the browser, WebSocket connections go straight from your computer.",
    sections: [
      {
        heading: "Connect and send",
        steps: [
          { title: "Enter a ws:// or wss:// URL.", text: "Send becomes Connect. Placeholders in the URL and headers are filled in from the active environment." },
          { title: "Connect.", text: "The status reads Connecting, then Connected. Each tab keeps its own session, and closing the tab ends it." },
          { title: "Type a message and press Ctrl+Enter.", text: "Variables and dynamic values such as {{$randomEmail}} are filled in when the message is sent, and the log shows it as it went out." },
          { title: "Save the messages you reuse.", text: "Saved messages are part of the request, so they travel with exports and with the collection folder in Git." },
        ],
        shot: { file: "gostman-gui/frontend/src/assets/landing/websocket.webp", alt: "A WebSocket session connected to ws://localhost:4000/live: a hello message, a subscribe message that was sent and three order events received in the log" },
      },
      {
        heading: "Socket.IO",
        paragraphs: ["Choose Socket.IO in the protocol list to talk to a Socket.IO 3 or 4 server. The URL path is the namespace, Path changes /socket.io/ for servers set up with another one, and Auth payload is the JSON object the server reads as socket.handshake.auth. Type an event name and its argument; received events show their name above the arguments, and acknowledgements show with their id."],
        shot: { file: "screenshots/socketio.webp", alt: "A Socket.IO session that joined the / namespace, received a welcome event, emitted question with a JSON argument and received question:ack back" },
      },
      {
        heading: "MQTT over WebSocket",
        paragraphs: ["Choose MQTT to talk to a broker over MQTT 3.1.1 on WebSocket, such as ws://localhost:8080/mqtt. Subscribe to a topic filter like sensors/#, publish to a topic at QoS 0, and read each message under its topic. Basic auth sends a user name and password. Brokers that only listen on TCP port 1883, without WebSocket, cannot be reached."],
        shot: { file: "screenshots/mqtt.webp", alt: "An MQTT session subscribed to sensors/#, receiving readings on sensors/warehouse and sensors/cold-store" },
      },
      {
        heading: "SignalR and GraphQL subscriptions",
        items: [
          "SignalR hubs with the JSON protocol: Gostman negotiates, completes the handshake, sends invocations and answers pings. MessagePack is not supported.",
          "GraphQL subscriptions with the graphql-transport-ws protocol used by graphql-ws and Apollo Server. The older subscriptions-transport-ws protocol is not supported.",
        ],
        shot: { file: "screenshots/graphql-subscription.webp", alt: "A GraphQL subscription over WebSocket: the connection is acknowledged, then each result arrives as next" },
      },
      {
        heading: "The message log",
        items: [
          "Each entry shows a time, whether it was sent, received, info, a warning or an error, and the text, with a button to copy it",
          "The log keeps the latest 1000 entries; text longer than 10,000 characters is shortened, and binary messages show as hexadecimal bytes",
          "Auto-reconnect waits 3 seconds after a connection closes or fails and tries again",
        ],
      },
      {
        heading: "Browser and desktop",
        paragraphs: [
          "A browser can set only the Sec-WebSocket-Protocol header on a WebSocket, so the web app sends that one and lists the others it cannot send. The desktop app sends every header, including Authorization.",
          "WebSocket requests live in the same collection as your REST calls, with the same environments and variables. They are interactive sessions, so the collection runner and gostman run skip them.",
        ],
      },
    ],
    comparison: comparisonOf("WebSocket", [POSTMAN, HOPPSCOTCH], [
      { feature: "In the browser, no install", gostman: included("Connects straight from the browser"), postman: POSTMAN_WEB, hoppscotch: included("hoppscotch.io") },
      { feature: "Desktop app", gostman: included("Sends every header"), postman: included("Yes"), hoppscotch: included("Yes") },
      { feature: "Works without an account", gostman: GOSTMAN_ACCOUNT, postman: POSTMAN_ACCOUNT, hoppscotch: included("Sign-in optional") },
      { feature: "Open source", gostman: GOSTMAN_SOURCE, postman: POSTMAN_SOURCE, hoppscotch: included("MIT") },
      { feature: "Socket.IO", gostman: included("Socket.IO 3 and 4"), postman: included("Yes"), hoppscotch: included("Yes") },
      { feature: "MQTT", gostman: included("MQTT 3.1.1 over WebSocket"), postman: included("Yes"), hoppscotch: included("Yes") },
      { feature: "Requests as files in Git", gostman: included("Saved messages travel with the request"), postman: POSTMAN_GIT, hoppscotch: partial("JSON export") },
    ]),
    faq: {
      heading: "Questions about the WebSocket client",
      entries: [
        { question: "Can I test a WebSocket online without installing anything?", answer: "Yes. Open gostman.com/web, enter a ws:// or wss:// URL and select Connect. The connection goes straight from your browser, not through a server." },
        { question: "Can I send an Authorization header on a WebSocket?", answer: "In the desktop app, yes: it sends every header. In the browser only Sec-WebSocket-Protocol can be set, because browsers do not allow other headers on a WebSocket. Socket.IO servers can read a token from the Auth payload instead." },
        { question: "Does it support Socket.IO?", answer: "Yes, Socket.IO 3 and 4, with namespaces, a custom path, an auth payload, events and acknowledgements." },
        { question: "Can it connect to an MQTT broker?", answer: "Yes, over WebSocket with MQTT 3.1.1. Brokers that only accept plain TCP on port 1883 cannot be reached." },
        { question: "Does it reconnect automatically?", answer: "Turn on Auto-reconnect and Gostman waits 3 seconds after the connection drops, then tries again." },
        { question: "Is it free?", answer: "Yes. Gostman is open source with no account and no paid tier." },
      ],
    },
    links: [
      { label: "WebSocket in the docs", href: `${docPath("protocols")}#websocket` },
      { label: "Socket.IO", href: `${docPath("protocols")}#socketio` },
      { label: "MQTT", href: `${docPath("protocols")}#mqtt` },
    ],
  },
  {
    path: "graphql-client",
    title: "GraphQL client online, with schema browser | Gostman",
    description: "An online GraphQL client: write queries with variables, browse the schema, build queries by clicking fields, upload files and run subscriptions over WebSocket or server-sent events. Free, no account.",
    heading: "A GraphQL client with a schema browser",
    intro: "Choose GRAPHQL, write a query and its variables, and send. Load the schema to browse types and fields, or build a query by picking fields, then add checks so the same query works as a test in the app and in CI.",
    sections: [
      {
        heading: "Send a query",
        steps: [
          { title: "Choose GRAPHQL and enter the endpoint.", text: "Gostman sends a POST request with a JSON body that holds the query and, when you give them, the variables." },
          { title: "Write the query.", text: "The editor checks the syntax as you type and shows an error with its line and column. Prettify reformats the query." },
          { title: "Add variables.", text: "Variables are a JSON object, and {{placeholders}} in them come from your environment." },
          { title: "Send and check the result.", text: "The response opens as a JSON tree. Add checks on the body, and the query becomes a test." },
        ],
        shot: { file: "gostman-gui/frontend/src/assets/landing/graphql.webp", alt: "A GraphQL request named Countries by continent with a query, a Variables (JSON) section, the schema browser and a 200 OK response that shows the countries" },
      },
      {
        heading: "Schema browser and query builder",
        paragraphs: [
          "Select Schema, then Fetch schema, and Gostman sends an introspection query with the URL, headers and auth of the request. Search types and fields by name, and expand a type to see its fields, arguments and descriptions.",
          "Builder uses the same schema. Switch between Query, Mutation and Subscription, tick fields and arguments, and Gostman writes the query into the editor and updates the variables. Fields a fragment already selects stay locked, so the builder never fights a query you wrote by hand.",
        ],
      },
      {
        heading: "Subscriptions and file uploads",
        items: [
          "Subscriptions over WebSocket with graphql-transport-ws, the protocol of graphql-ws and Apollo Server, with the request's headers and auth sent in connection_init",
          "Subscriptions delivered as server-sent events, with Stream as server-sent events turned on",
          "File uploads with the GraphQL multipart request spec: name the variable a file belongs to, such as input.avatar, and Gostman sends operations, map and one part per file",
        ],
      },
      sameCollectionSection(WEB_APP_REACH),
    ],
    comparison: comparisonOf("GraphQL", [POSTMAN, { id: "altair", name: "Altair" }, { id: "insomnia", name: "Insomnia" }], [
      { feature: "In the browser, no install", gostman: GOSTMAN_WEB, postman: POSTMAN_WEB, altair: included("Web app"), insomnia: excluded("Desktop only") },
      { feature: "Works without an account", gostman: GOSTMAN_ACCOUNT, postman: POSTMAN_ACCOUNT, altair: included("Sign-in only for cloud saves"), insomnia: partial("Scratch Pad only") },
      { feature: "Open source", gostman: GOSTMAN_SOURCE, postman: POSTMAN_SOURCE, altair: included("MIT"), insomnia: included("Apache-2.0") },
      { feature: "Schema browser", gostman: included("Search types and fields"), postman: included("Yes"), altair: included("Docs viewer"), insomnia: included("Show Documentation") },
      { feature: "Build a query by picking fields", gostman: included("Fields and arguments"), postman: included("Visual query editor"), altair: partial("Add queries from the docs"), insomnia: excluded("Not in its docs") },
      { feature: "Subscriptions", gostman: included("WebSocket or server-sent events"), postman: included("Yes"), altair: included("WebSocket and server-sent events"), insomnia: included("Yes") },
      { feature: "Requests as files in Git", gostman: GOSTMAN_GIT, postman: POSTMAN_GIT, altair: partial("Export and import"), insomnia: included("Git Sync, free up to 3 users") },
    ]),
    faq: {
      heading: "Questions about the GraphQL client",
      entries: [
        { question: "Can I use it as an online GraphQL playground?", answer: "Yes. Open gostman.com/web, choose GRAPHQL, enter the endpoint and send. There is no account and nothing to install." },
        { question: "How does the schema browser get the schema?", answer: "It sends an introspection query with the request's own URL, headers and auth, so it works with APIs that need a token. A server with introspection turned off returns no schema." },
        { question: "Does it support subscriptions?", answer: "Yes, over WebSocket with the graphql-transport-ws protocol, or as server-sent events. The older subscriptions-transport-ws protocol is not supported." },
        { question: "Can I upload files to a GraphQL API?", answer: "Yes, with the GraphQL multipart request spec, from the Files tab. In the web app files are limited to 3 MB." },
        { question: "Can I run GraphQL queries in CI?", answer: "Yes. Queries over HTTP are saved in the collection with their checks, and gostman run sends them like any other request." },
      ],
    },
    links: [
      { label: "GraphQL in the docs", href: `${docPath("protocols")}#graphql` },
      { label: "GraphQL subscriptions", href: `${docPath("protocols")}#graphql-subscriptions` },
    ],
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
        heading: "Call a tool",
        steps: [
          { title: "Choose MCP and enter the server.", text: "A remote server is its Streamable HTTP URL. In the desktop app, stdio: followed by a command starts a local server." },
          { title: "Load it.", text: "The server line shows its name, version and the MCP protocol version in use, and Checks counts the problems found in its tool definitions." },
          { title: "Pick a tool.", text: "Its description appears under the toolbar, Schema shows the JSON Schema of its arguments, and Use example fills in arguments built from that schema." },
          { title: "Send.", text: "The body is the server's result with content and isError. A tool error, a JSON-RPC error or an HTTP error each count as a failure." },
        ],
        shot: { file: "gostman-gui/frontend/src/assets/landing/mcp.webp", alt: "An MCP request with the server line storefront-mcp 1.2.0, the search_products tool, JSON arguments and an OK response" },
      },
      {
        heading: "What it does",
        items: [
          "Remote servers over Streamable HTTP, and local servers over stdio in the desktop app",
          "Call tool, read resource and get prompt, plus list operations that follow every page",
          "MCP 2026-07-28 and the revisions that start with initialize, back to 2024-11-05",
          "Sign in with OAuth, following the MCP authorization specification step by step",
          "Progress and log notifications listed with the time each arrived, and images and audio in results shown as media",
          "structuredContent checked against the tool's output schema",
          "Tool errors count as failures in the collection runner and gostman run",
        ],
      },
      {
        heading: "Checks on tool definitions",
        paragraphs: ["After a Load, Gostman checks the tool definitions with fixed rules, not a model: missing or very short descriptions, duplicate or near-duplicate names, invalid names, malformed input schemas, undescribed parameters and more than 40 tools. When a later Load finds new, removed or changed tools, a warning lists them with the old and new descriptions, because a changed description can carry instructions you have not read."],
      },
      {
        heading: "Sign in with OAuth",
        paragraphs: ["Sign in follows the MCP authorization specification and shows each step as it runs: the WWW-Authenticate challenge, protected resource metadata, authorization server metadata, client registration, the browser sign-in with PKCE, the issuer check and the token exchange. Select a step to see the requests it made, and a failed step opens with a plain explanation of what to change."],
      },
      {
        heading: "Local commands are confirmed",
        paragraphs: ["The first time a stdio command runs, Gostman shows it and asks before starting it, and asks again when the command or its environment changes. Headers become environment variables of the program. The web app, gostman run and agent sessions never start local commands."],
        shot: { file: "screenshots/mcp-stdio.webp", alt: "An MCP request to a local server started with the command storefront-mcp: the server line, the get_product tool, its JSON arguments and the response" },
      },
    ],
    comparison: comparisonOf("MCP", [{ id: "mcp-inspector", name: "MCP Inspector" }, POSTMAN], [
      { feature: "In the browser, no install", gostman: included("Remote servers in the web app"), "mcp-inspector": partial("Local web page started with npx"), postman: POSTMAN_WEB },
      { feature: "Works without an account", gostman: GOSTMAN_ACCOUNT, "mcp-inspector": included("Yes"), postman: POSTMAN_ACCOUNT },
      { feature: "Open source", gostman: GOSTMAN_SOURCE, "mcp-inspector": included("Apache-2.0 and MIT"), postman: POSTMAN_SOURCE },
      { feature: "Streamable HTTP and stdio servers", gostman: included("Both; stdio in the desktop app"), "mcp-inspector": included("Both"), postman: included("Both") },
      { feature: "OAuth sign-in", gostman: included("Each step shown as it runs"), "mcp-inspector": included("Yes"), postman: partial("Auth types; OAuth not named in its docs") },
      { feature: "Saved calls as tests in CI", gostman: GOSTMAN_CI, "mcp-inspector": partial("Scripted CLI calls"), postman: partial("Postman CLI, cli reporter only") },
    ]),
    faq: {
      heading: "Questions about testing MCP servers",
      entries: [
        { question: "Can I test a remote MCP server in the browser?", answer: "Yes. The web app at gostman.com/web loads Streamable HTTP servers, calls their tools and signs in with OAuth through a pop-up. Local stdio servers need the desktop app." },
        { question: "Which MCP versions does it support?", answer: "MCP 2026-07-28, and the earlier revisions that start with an initialize handshake: 2025-11-25, 2025-06-18, 2025-03-26 and 2024-11-05. Gostman probes with server/discover and falls back to initialize." },
        { question: "Can I run MCP tool calls as tests in CI?", answer: "Yes. Save the calls in a collection, add checks such as res.body.isError is false, and gostman run sends them. A tool error fails the run and appears in JUnit reports with the tool's text." },
        { question: "Does it use an AI model to check my tools?", answer: "No. The checks on tool definitions are fixed rules, and nothing is sent to a model." },
        { question: "How is this different from Gostman's own MCP server?", answer: "This page is about testing your MCP server. gostman mcp is the other direction: it lets a coding agent call your API through your collection." },
        { question: "Is it free?", answer: "Yes. Gostman is open source with no account and no paid tier." },
      ],
    },
    links: [
      { label: "MCP servers in the docs", href: `${docPath("protocols")}#mcp-servers` },
      { label: "Sign in with OAuth", href: `${docPath("protocols")}#sign-in-with-oauth` },
      { label: "Use Gostman from a coding agent", href: docPath("agents") },
    ],
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
