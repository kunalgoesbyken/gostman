const DEFAULT_SITE_URL = 'https://gostman.vercel.app'
const SITE_URL_TOKEN = '__SITE_URL__'

export const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')

const sitemapXml = (url) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}/</loc>
  </url>
</urlset>
`

const robotsTxt = (url) => `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${url}/sitemap.xml
`

export function siteMeta() {
  return {
    name: 'site-meta',
    transformIndexHtml: { enforce: 'pre', transform: (html) => html.replaceAll(SITE_URL_TOKEN, siteUrl) },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
    },
  }
}

export const siteDefine = { __SITE_URL__: JSON.stringify(siteUrl) }
