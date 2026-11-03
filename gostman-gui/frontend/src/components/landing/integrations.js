import { docPath } from "../../docs/manifest"

const guide = (slug, anchor) => (anchor ? `${docPath(slug)}#${anchor}` : docPath(slug))

const SECRETS = "secrets-and-network"
const INSTALL = guide("getting-started", "install-the-desktop-app")

export const INTEGRATIONS = [
  { brand: "postman", name: "Postman", line: "Import collections and environments, or export one back", href: guide("coming-from-postman") },
  { brand: "claude", name: "Claude Code", line: "Call your APIs through the Gostman MCP server", href: guide("agents") },
  { brand: "github-actions", name: "GitHub Actions", line: "Run a collection with the Gostman action", href: guide("ci", "github-actions") },
  { brand: "openapi", name: "OpenAPI", line: "Import or design a spec, then check responses against it", href: guide("import-export-and-specs", "openapi-specs") },
  { brand: "vault", name: "HashiCorp Vault", line: "Read secrets into variables with a Vault reference", href: guide(SECRETS, "secret-managers") },
  { brand: "cursor", name: "Cursor", line: "Call your APIs from Cursor through MCP", href: guide("agents") },
  { brand: "insomnia", name: "Insomnia", line: "Import Insomnia exports, hand back a Postman file", href: guide("coming-from-insomnia") },
  { brand: "docker", name: "Docker", line: "Run collections from the official container image", href: guide("ci", "docker") },
  { brand: "bruno", name: "Bruno", line: "Import Bruno collections, export .bru files back", href: guide("coming-from-bruno") },
  { brand: "openai", name: "OpenAI", line: "Bring your own OpenAI key for AI features", href: guide("ai") },
  { brand: "github", name: "GitHub", line: "Create a repository and push from the Git panel", href: guide("collections-and-git", "remotes") },
  { brand: "onepassword", name: "1Password", line: "Read variables through the 1Password CLI", href: guide(SECRETS, "1password") },
  { brand: "gitlab", name: "GitLab", line: "Run collections in GitLab CI with a JUnit report", href: guide("ci", "gitlab-ci") },
  { brand: "aws", name: "AWS Secrets Manager", line: "Read secrets into variables with a reference", href: guide(SECRETS, "secret-managers") },
  { brand: "linux", name: "Linux", line: "Desktop app as .deb, AppImage or tarball", href: INSTALL },
  { brand: "macos", name: "macOS", line: "Universal installer for Intel and Apple Silicon", href: INSTALL },
  { brand: "windows", name: "Windows", line: "Installer or portable executable", href: INSTALL },
  { brand: "azure", name: "Azure Key Vault", line: "Read secrets into variables with a reference", href: guide(SECRETS, "secret-managers") },
  { brand: "bitwarden", name: "Bitwarden", line: "Read variables through the Bitwarden CLI", href: guide(SECRETS, "bitwarden") },
  { brand: "gcp", name: "Google Cloud Secret Manager", line: "Read secrets into variables with a reference", href: guide(SECRETS, "secret-managers") },
  { brand: "gemini", name: "Gemini", line: "Bring your own Gemini key for AI features", href: guide("ai") },
  { brand: "keepassxc", name: "KeePassXC", line: "Read entries from an unlocked database (desktop)", href: guide(SECRETS, "keepassxc") },
  { brand: "ollama", name: "Ollama", line: "Use a local Ollama model for AI features", href: guide("ai") },
  { brand: "bitbucket", name: "Bitbucket", line: "Run collections in Bitbucket Pipelines", href: guide("ci", "bitbucket-pipelines") },
  { brand: "openrouter", name: "OpenRouter", line: "Bring your own OpenRouter key for AI features", href: guide("ai") },
]
