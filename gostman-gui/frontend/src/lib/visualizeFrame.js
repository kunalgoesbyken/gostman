const WEB_SOURCES = 'http: https:'
const LOCAL_SOURCES = 'data:'
const LOCKED = "default-src 'none'; form-action 'none'; base-uri 'none'"
const STRICT_POLICY = `${LOCKED}; style-src 'unsafe-inline'; img-src ${LOCAL_SOURCES}; font-src ${LOCAL_SOURCES}; media-src ${LOCAL_SOURCES}`
const REMOTE_POLICY = `${LOCKED}; style-src 'unsafe-inline' ${WEB_SOURCES}; img-src ${LOCAL_SOURCES} ${WEB_SOURCES}; font-src ${LOCAL_SOURCES} ${WEB_SOURCES}; media-src ${LOCAL_SOURCES} ${WEB_SOURCES}`
const WEB_SCHEMES = ['http:', 'https:']
const DOCTYPE = '<!doctype'
const DOCTYPE_END = '>'
const PRIVATE_HEAD = '<meta name="referrer" content="no-referrer"><meta http-equiv="x-dns-prefetch-control" content="off">'

const BASE_STYLE = [
  'body{margin:12px;font:13px/1.5 system-ui,sans-serif;color:#1a1a1a;background:#fff;overflow-wrap:anywhere}',
  'table{border-collapse:collapse;width:100%}',
  'th,td{border:1px solid #d4d4d4;padding:4px 8px;text-align:left;vertical-align:top}',
  'th{background:#f3f3f3}',
].join('')

const policyTag = (policy) => `<meta http-equiv="Content-Security-Policy" content="${policy}">`

const escapeAttribute = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function webAddress(url) {
  try {
    const parsed = new URL(url)
    return WEB_SCHEMES.includes(parsed.protocol) ? parsed.href : ''
  } catch {
    return ''
  }
}

const baseTag = (address) => `<base target="_blank"${address ? ` href="${escapeAttribute(address)}"` : ''}>`

function withHead(html, head) {
  const text = html.trimStart()
  if (text.slice(0, DOCTYPE.length).toLowerCase() !== DOCTYPE) return head + text
  const end = text.indexOf(DOCTYPE_END) + DOCTYPE_END.length
  return text.slice(0, end) + head + text.slice(end)
}

export const previewDocument = (html, { remote, url }) => withHead(
  html,
  baseTag(remote ? webAddress(url) : '') + policyTag(remote ? REMOTE_POLICY : STRICT_POLICY) + PRIVATE_HEAD,
)

export const frameDocument = (html) => (
  `<!doctype html><html><head><meta charset="utf-8">${policyTag(STRICT_POLICY)}<base target="_blank">`
  + `<style>${BASE_STYLE}</style></head><body>${html}</body></html>`
)
