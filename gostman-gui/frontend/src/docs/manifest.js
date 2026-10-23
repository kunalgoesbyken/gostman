export const docSections = [
  {
    title: "Start",
    docs: [
      { file: "README.md" },
      { file: "getting-started.md" },
      { file: "free-features.md", comparison: true },
      { file: "coming-from-bruno.md" },
    ],
  },
  {
    title: "Learn",
    docs: [
      { file: "tutorial-first-collection.md" },
      { file: "tutorial-ci.md" },
      { file: "guides.md" },
      { file: "troubleshooting.md" },
    ],
  },
  {
    title: "Send requests",
    docs: [
      { file: "requests-and-responses.md" },
      { file: "protocols.md" },
      { file: "variables.md" },
      { file: "folder-settings.md" },
      { file: "scripting-and-settings.md" },
    ],
  },
  {
    title: "Test and automate",
    docs: [{ file: "runner-load-and-scan.md" }, { file: "cli.md" }, { file: "ci.md" }, { file: "agents.md" }],
  },
  {
    title: "Your data",
    docs: [
      { file: "collections-and-git.md" },
      { file: "workspaces-and-mock.md" },
      { file: "import-export-and-specs.md" },
      { file: "sharing-and-docs.md" },
    ],
  },
  {
    title: "Settings and security",
    docs: [{ file: "secrets-and-network.md" }, { file: "preferences-and-shortcuts.md" }, { file: "ai.md" }],
  },
]

const HOME_FILE = "README.md"

export const docFiles = docSections.flatMap((section) => section.docs.map((doc) => doc.file))

export const docSlug = (file) => (file === HOME_FILE ? "" : file.replace(/\.md$/, ""))

export const docPath = (slug) => (slug ? `/docs/${slug}` : "/docs")

export const docOutputFile = (slug) => (slug ? `docs/${slug}/index.html` : "docs/index.html")
