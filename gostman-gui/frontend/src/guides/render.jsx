import { renderToStaticMarkup } from "react-dom/server"
import { GuidePage } from "../components/GuidePage"

const THEME_COLOR = "#050810"

const structuredData = (page, url, siteUrl) =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.heading,
    description: page.description,
    url,
    isPartOf: { "@type": "WebSite", name: "Gostman", url: `${siteUrl}/` },
  }).replace(/</g, "\\u003c")

function GuideDocument({ page, siteUrl, stylesheets }) {
  const url = `${siteUrl}/${page.path}`

  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{page.title}</title>
        <meta name="description" content={page.description} />
        <link rel="canonical" href={url} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta property="og:site_name" content="Gostman" />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={page.description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`${siteUrl}/og.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        {stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData(page, url, siteUrl) }} />
      </head>
      <body>
        <GuidePage page={page} />
      </body>
    </html>
  )
}

export const renderGuidePage = (page, options) =>
  `<!DOCTYPE html>${renderToStaticMarkup(<GuideDocument page={page} {...options} />)}`
