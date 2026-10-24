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
      internal("All documentation", docPath("")),
    ],
  },
  {
    title: "Guides",
    links: guidePages.map((page) => internal(page.heading, `/${page.path}`)),
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
