import { Suspense } from "react"
import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { DocsContent } from "../components/docs/DocsContent"
import { DocsShell } from "../components/docs/DocsShell"
import { GuidePage } from "../components/GuidePage"
import { AgentsPage } from "../components/landing/agents/AgentsPage"
import { FeaturesPage } from "../components/landing/features/FeaturesPage"
import { LandingPage } from "../components/LandingPage"
import { AppSkeletonFrame } from "../components/AppSkeletonFrame"
import { SiteFooter } from "../components/landing/SiteFooter"
import { docPath } from "../docs/manifest"
import { faqPage, jsonLd, scriptJson, socialImagePath, softwareApplication, softwareApplicationId } from "./structuredData"

const THEME_COLOR = "#050810"

const webSite = (siteUrl) => ({ "@type": "WebSite", name: "Gostman", url: `${siteUrl}/` })

const SOCIAL_IMAGE_PATH = "/social.png"

function PageDocument({ title, description, url, siteUrl, image = SOCIAL_IMAGE_PATH, stylesheets, scripts = [], structuredData, children }) {
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
        <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta property="og:site_name" content="Gostman" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`${siteUrl}${image}`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:image" content={`${siteUrl}${image}`} />
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      </head>
      <body>{children}</body>
    </html>
  )
}

const renderDocument = (props) => `<!DOCTYPE html>${renderToStaticMarkup(<PageDocument {...props} />)}`

const PRODUCT_PAGES = { "ai-agents": AgentsPage, features: FeaturesPage }

function renderWebPage(page, { siteUrl, stylesheets, scripts }, children) {
  const url = `${siteUrl}/${page.path}`
  const webPage = {
    "@type": "WebPage",
    name: page.heading,
    description: page.description,
    url,
    isPartOf: webSite(siteUrl),
    about: { "@id": softwareApplicationId(siteUrl) },
  }

  return renderDocument({
    title: page.title,
    description: page.description,
    url,
    siteUrl,
    image: socialImagePath(page),
    stylesheets,
    scripts,
    structuredData: { "@graph": [webPage, softwareApplication(siteUrl, __APP_VERSION__), ...(page.faq ? [faqPage(page.faq.entries)] : [])] },
    children,
  })
}

export const renderGuidePage = (page, options) => renderWebPage(page, options, <GuidePage page={page} />)

export function renderProductPage(page, options) {
  const Body = PRODUCT_PAGES[page.path]
  return renderWebPage(page, options, <Body page={page} />)
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
        <script id="docs-data" type="application/json" dangerouslySetInnerHTML={{ __html: scriptJson(data) }} />
      </>
    ),
  })
}

const stayOnPage = () => {}

export const renderLandingMarkup = () =>
  renderToString(
    <Suspense fallback={null}>
      <LandingPage onGetStarted={stayOnPage} />
    </Suspense>,
  )

export const renderAppSkeletonMarkup = () => renderToStaticMarkup(<AppSkeletonFrame />)
