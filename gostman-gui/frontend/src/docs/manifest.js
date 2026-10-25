export const docSections = [
  {
    title: "Start",
    aliases: ["where-to-start", "learn"],
    docs: [
      { file: "README.md", label: "Introduction" },
      { file: "getting-started.md" },
      { file: "free-features.md", label: "What is free", comparison: true },
      { file: "coming-from-postman.md" },
      { file: "coming-from-bruno.md" },
      { file: "coming-from-insomnia.md" },
      { file: "tutorial-first-collection.md", label: "Your first collection" },
      { file: "tutorial-ci.md", label: "Your first CI run" },
    ],
  },
  {
    title: "Requests",
    aliases: ["send-requests"],
    docs: [
      { file: "requests-and-responses.md", outline: true, aliases: { tests: "checks" } },
      { file: "protocols.md", outline: true, aliases: { "load-the-tools": "load-the-server" } },
    ],
  },
  {
    title: "Variables and secrets",
    aliases: ["settings-and-security"],
    docs: [
      { file: "variables.md", outline: true },
      { file: "secrets-and-network.md", label: "Secrets and network", outline: true },
    ],
  },
  {
    title: "Testing and automation",
    aliases: ["test-and-automate"],
    docs: [
      { file: "scripting-and-settings.md", label: "Scripts and checks", aliases: { "tests-and-scripts": "checks-and-scripts" } },
      { file: "runner-load-and-scan.md", label: "Run, load test and scan" },
      { file: "ci.md", label: "CI", outline: true },
    ],
  },
  {
    title: "Collections and Git",
    aliases: ["your-data"],
    docs: [
      { file: "collections-and-git.md", label: "Collections, tabs and Git", outline: true },
      { file: "folder-settings.md", label: "Folder settings" },
      { file: "workspaces-and-mock.md", label: "Folders, mock and capture" },
      { file: "import-export-and-specs.md", label: "Import, export and OpenAPI", outline: true },
      { file: "sharing-and-docs.md", label: "Sharing and docs" },
    ],
  },
  {
    title: "Agents and AI",
    docs: [{ file: "agents.md", label: "Coding agents (MCP)" }, { file: "ai.md", label: "AI features" }],
  },
  {
    title: "Reference",
    docs: [
      { file: "cli.md", outline: true },
      { file: "preferences-and-shortcuts.md", label: "Preferences and shortcuts", outline: true },
    ],
  },
  {
    title: "Help",
    docs: [{ file: "guides.md" }, { file: "troubleshooting.md", aliases: { "tests-and-runs": "checks-and-runs" } }],
  },
]

export const HOME_FILE = "README.md"

export const docFiles = docSections.flatMap((section) => section.docs.map((doc) => doc.file))

export const docSlug = (file) => (file === HOME_FILE ? "" : file.replace(/\.md$/, ""))

export const docPath = (slug) => (slug ? `/docs/${slug}` : "/docs")

export const docOutputFile = (slug) => (slug ? `docs/${slug}/index.html` : "docs/index.html")
