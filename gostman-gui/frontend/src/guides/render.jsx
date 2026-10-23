import { renderToStaticMarkup } from "react-dom/server"
import { DocsPage } from "../components/DocsPage"
import { GuidePage } from "../components/GuidePage"
import { docPath } from "../docs/manifest"

const THEME_COLOR = "#050810"

const webSite = (siteUrl) => ({ "@type": "WebSite", name: "Gostman", url: `${siteUrl}/` })

const serialize = (data) => JSON.stringify(data).replace(/</g, "\\u003c")

function PageDocument({ title, description, url, siteUrl, stylesheets, structuredData, children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="/theme-boot.js" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta property="og:site_name" content="Gostman" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`${siteUrl}/og.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        {stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialize(structuredData) }} />
      </head>
      <body>{children}</body>
    </html>
  )
}

const renderDocument = (props) => `<!DOCTYPE html>${renderToStaticMarkup(<PageDocument {...props} />)}`

export function renderGuidePage(page, { siteUrl, stylesheets }) {
  const url = `${siteUrl}/${page.path}`

  return renderDocument({
    title: page.title,
    description: page.description,
    url,
    siteUrl,
    stylesheets,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.heading,
      description: page.description,
      url,
      isPartOf: webSite(siteUrl),
    },
    children: <GuidePage page={page} />,
  })
}

const breadcrumbItem = (position, name, url) => ({ "@type": "ListItem", position, name, item: url })

function docsBreadcrumbs(page, siteUrl, url) {
  const trail = [breadcrumbItem(1, "Gostman", `${siteUrl}/`), breadcrumbItem(2, "Documentation", `${siteUrl}${docPath("")}`)]
  return page.slug ? [...trail, breadcrumbItem(3, page.title, url)] : trail
}

export function renderDocsPage(page, { siteUrl, stylesheets, nav }) {
  const url = `${siteUrl}${docPath(page.slug)}`
  const title = page.slug ? `${page.title} | Gostman docs` : `${page.title} | Gostman`

  return renderDocument({
    title,
    description: page.description,
    url,
    siteUrl,
    stylesheets,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: page.title,
      description: page.description,
      url,
      isPartOf: webSite(siteUrl),
      breadcrumb: { "@type": "BreadcrumbList", itemListElement: docsBreadcrumbs(page, siteUrl, url) },
    },
    children: <DocsPage page={page} nav={nav} />,
  })
}
