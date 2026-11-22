import { RELEASES_URL, REPOSITORY_URL } from "../lib/siteLinks.js"

const VSCODE_MARKETPLACE_URL = "https://marketplace.visualstudio.com/items?itemName=Gostman.gostman"

export const scriptJson = (data) => JSON.stringify(data).replace(/</g, "\\u003c")

export const jsonLd = (data) => scriptJson({ "@context": "https://schema.org", ...data })

export const softwareApplicationId = (siteUrl) => `${siteUrl}/#software`

export const softwareApplication = (siteUrl, version) => ({
  "@type": "SoftwareApplication",
  "@id": softwareApplicationId(siteUrl),
  name: "Gostman",
  alternateName: ["Gostman API client", "Gostman REST client"],
  url: `${siteUrl}/`,
  description: "An open source API client for REST, GraphQL, gRPC and WebSocket with a command line for CI, a mock server and an MCP server for coding agents.",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Windows, macOS, Linux, Web",
  softwareVersion: version,
  isAccessibleForFree: true,
  featureList: [
    "REST, GraphQL, gRPC, WebSocket and MCP requests",
    "Tests and scripts that run on every send",
    "Command line runner for CI with JUnit reports",
    "Collections stored as YAML files for Git",
    "Mock server from saved responses",
    "Import from Postman, Insomnia, Bruno, OpenAPI, HAR and curl",
    "MCP server for coding agents",
    "No account and no paid tier",
  ],
  image: `${siteUrl}/social.png`,
  downloadUrl: RELEASES_URL,
  installUrl: `${siteUrl}/web`,
  codeRepository: REPOSITORY_URL,
  sameAs: [REPOSITORY_URL, VSCODE_MARKETPLACE_URL],
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@id": `${siteUrl}/#organization` },
})

export const faqPage = (entries) => ({
  "@type": "FAQPage",
  mainEntity: entries.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
})

export const socialImagePath = (page) => `/og/${page.path}.png`
