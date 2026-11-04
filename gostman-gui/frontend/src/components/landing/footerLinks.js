import { docPath } from "../../docs/manifest"
import { ISSUES_URL, RELEASES_URL, REPOSITORY_URL } from "../../lib/siteLinks"

const internal = (label, href) => ({ label, href })
const guide = (path, label) => internal(label, `/${path}`)
const external = (label, href, brand) => ({ label, href, brand, external: true })

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      internal("Web app", "/web"),
      external("Download", RELEASES_URL),
      internal("Command line", docPath("cli")),
      internal("Coding agents", docPath("agents")),
      internal("VS Code extension", docPath("vscode")),
    ],
  },
  {
    title: "Docs",
    links: [
      internal("Getting started", docPath("getting-started")),
      internal("First collection", docPath("tutorial-first-collection")),
      internal("Tests in CI", docPath("tutorial-ci")),
      internal("Variables", docPath("variables")),
      internal("Troubleshooting", docPath("troubleshooting")),
      internal("All documentation", docPath("")),
    ],
  },
  {
    title: "Guides",
    links: [
      guide("api-tests-in-ci", "API tests in CI"),
      guide("api-client-mcp-server", "MCP server for agents"),
      guide("online-api-tester", "Test an API online"),
      guide("grpc-client", "gRPC client"),
      guide("websocket-client", "WebSocket client"),
      guide("graphql-client", "GraphQL client"),
    ],
  },
  {
    title: "Alternatives",
    links: [
      guide("postman-alternative", "Postman alternative"),
      guide("bruno-alternative", "Bruno alternative"),
      guide("insomnia-alternative", "Insomnia alternative"),
      guide("thunder-client-alternative", "Thunder Client alternative"),
      guide("hoppscotch-alternative", "Hoppscotch alternative"),
      guide("yaak-alternative", "Yaak alternative"),
      internal("Coming from Postman", docPath("coming-from-postman")),
      internal("Coming from Bruno", docPath("coming-from-bruno")),
      internal("Coming from Insomnia", docPath("coming-from-insomnia")),
    ],
  },
  {
    title: "Project",
    links: [
      external("Source on GitHub", REPOSITORY_URL, "github"),
      external("Report an issue", ISSUES_URL),
      external("Releases", RELEASES_URL),
    ],
  },
]
