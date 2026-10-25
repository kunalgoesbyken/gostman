import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { DocsContent } from "../components/docs/DocsContent"
import { DocsShell } from "../components/docs/DocsShell"
import { GuidePage } from "../components/GuidePage"
import { LandingPage } from "../components/LandingPage"
import { SiteFooter } from "../components/landing/SiteFooter"
import { docPath } from "../docs/manifest"

const THEME_COLOR = "#050810"

const webSite = (siteUrl) => ({ "@type": "WebSite", name: "Gostman", url: `${siteUrl}/` })

const serialize = (data) => JSON.stringify(data).replace(/</g, "\\u003c")

function PageDocument({ title, description, url, siteUrl, stylesheets, scripts = [], structuredData, children }) {
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
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta property="og:site_name" content="Gostman" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`${siteUrl}/social.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        {stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {scripts.map((script) =>
          script.preload ? (
            <link key={script.src} rel="modulepreload" crossOrigin="" href={script.src} />
          ) : (
            <script key={script.src} type="module" crossOrigin="" src={script.src} />
          ),
        )}
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

const shellPage = (page) => ({ href: page.href, toc: page.toc })

export function renderDocsPage(page, { siteUrl, stylesheets, scripts, nav, directory, searchUrl }) {
  const url = `${siteUrl}${docPath(page.slug)}`
  const title = page.slug ? `${page.title} | Gostman docs` : `${page.title} | Gostman`
  const data = { nav, page: shellPage(page), searchUrl }
  const content = renderToStaticMarkup(<DocsContent page={page} directory={directory} />)
  const footer = renderToStaticMarkup(<SiteFooter />)
  const shell = renderToString(<DocsShell {...data} content={content} footer={footer} />)

  return renderDocument({
    title,
    description: page.description,
    url,
    siteUrl,
    stylesheets,
    scripts,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: page.title,
      description: page.description,
      url,
      isPartOf: webSite(siteUrl),
      breadcrumb: { "@type": "BreadcrumbList", itemListElement: docsBreadcrumbs(page, siteUrl, url) },
    },
    children: (
      <>
        <div id="docs-root" dangerouslySetInnerHTML={{ __html: shell }} />
        <script id="docs-data" type="application/json" dangerouslySetInnerHTML={{ __html: serialize(data) }} />
      </>
    ),
  })
}

const stayOnPage = () => {}

export const renderLandingMarkup = () => renderToString(<LandingPage onGetStarted={stayOnPage} />)
