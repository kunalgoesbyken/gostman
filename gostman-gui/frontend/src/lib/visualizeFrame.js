const POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'"

const BASE_STYLE = [
  'body{margin:12px;font:13px/1.5 system-ui,sans-serif;color:#1a1a1a;background:#fff;overflow-wrap:anywhere}',
  'table{border-collapse:collapse;width:100%}',
  'th,td{border:1px solid #d4d4d4;padding:4px 8px;text-align:left;vertical-align:top}',
  'th{background:#f3f3f3}',
].join('')

export const frameDocument = (html) => (
  `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${POLICY}"><base target="_blank">`
  + `<style>${BASE_STYLE}</style></head><body>${html}</body></html>`
)
