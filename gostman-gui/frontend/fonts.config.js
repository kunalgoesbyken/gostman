const FONT_ORIGINS = [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
]

export const FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap'

const headLink = (attrs) => ({ tag: 'link', attrs, injectTo: 'head-prepend' })

export function fontLinks() {
  return {
    name: 'font-links',
    transformIndexHtml: () => [...FONT_ORIGINS, { rel: 'stylesheet', href: FONT_STYLESHEET }].map(headLink),
  }
}
