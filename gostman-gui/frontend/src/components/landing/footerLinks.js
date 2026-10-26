import { docPath } from "../../docs/manifest"
import { guidePages } from "../../guides/pages"
import { ISSUES_URL, LICENSE_URL, RELEASES_URL, REPOSITORY_URL } from "../../lib/siteLinks"

const internal = (label, href) => ({ label, href })
const external = (label, href, brand) => ({ label, href, brand, external: true })

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      internal("Web app", "/web"),
      external("Download", RELEASES_URL),
      internal("Command line", docPath("cli")),
      internal("Coding agents", docPath("agents")),
    ],
  },
  {
    title: "Docs",
    links: [
      internal("Getting started", docPath("getting-started")),
      internal("First collection", docPath("tutorial-first-collection")),
      internal("Tests in CI", docPath("tutorial-ci")),
      internal("Variables", docPath("variables")),
      internal("Scripts and checks", docPath("scripting-and-settings")),
      internal("Flows", docPath("flows")),
      internal("Collections and Git", docPath("collections-and-git")),
      internal("Import and export", docPath("import-export-and-specs")),
      internal("Troubleshooting", docPath("troubleshooting")),
      internal("All documentation", docPath("")),
    ],
  },
  {
    title: "Guides",
    links: [
      ...guidePages.map((page) => internal(page.heading, `/${page.path}`)),
      internal("Gostman vs Postman", docPath("gostman-vs-postman")),
      internal("Gostman vs Bruno", docPath("gostman-vs-bruno")),
      internal("Gostman vs Insomnia", docPath("gostman-vs-insomnia")),
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
      external("MIT licence", LICENSE_URL),
    ],
  },
]
