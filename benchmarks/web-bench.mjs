import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://127.0.0.1:3911' },
    data: { type: 'string' },
    browser: { type: 'string' },
    'json-mb': { type: 'string', default: '20' },
    runs: { type: 'string', default: '3' },
    out: { type: 'string' },
    'format-labels': { type: 'string', default: 'Format anyway,Formatting…' },
  },
})

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]
const SEARCH_PLACEHOLDER = 'Search name, URL or tag'
const SETTLE_MS = 3000
const WAIT_MS = 120000
const SCROLL_STEPS = 300
const TREE_QUERIES = ['item 49', 'e', '']
const BODY_QUERY = 'user4999@'

const step = (label) => console.error(`  ${label}`)

const median = (list) => {
  const sorted = [...list].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const percentile = (list, share) => [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * share))]
const round = (value) => Math.round(value * 10) / 10
const megabytes = (bytes) => round(bytes / 1024 / 1024)

class Cdp {
  constructor(socket) {
    this.socket = socket
    this.nextId = 0
    this.pending = new Map()
    this.listeners = new Set()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id === undefined) {
        this.listeners.forEach((listener) => listener(message))
        return
      }
      const waiter = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`))
      else waiter.resolve(message.result)
    })
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId
    this.socket.send(JSON.stringify({ id, method, params, sessionId }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }))
  }

  once(method, sessionId) {
    return new Promise((resolve) => {
      const listener = (message) => {
        if (message.method !== method || message.sessionId !== sessionId) return
        this.listeners.delete(listener)
        resolve(message.params)
      }
      this.listeners.add(listener)
    })
  }
}

async function waitForFile(path) {
  const started = Date.now()
  while (!existsSync(path)) {
    if (Date.now() - started > WAIT_MS) throw new Error(`the browser did not start (${path} missing)`)
    await sleep(50)
  }
  await sleep(50)
  return readFileSync(path, 'utf8').trim().split('\n')
}

async function launch(executable) {
  const profile = mkdtempSync(join(tmpdir(), 'gostman-bench-'))
  const child = spawn(executable, [
    '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run',
    '--no-default-browser-check', '--window-size=1600,1000', '--enable-precise-memory-info',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--disable-features=CalculateNativeWinOcclusion', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' })
  const [port, path] = await waitForFile(join(profile, 'DevToolsActivePort'))
  const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  const cdp = new Cdp(socket)
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const page = (method, params) => cdp.send(method, params, sessionId)
  const close = async () => {
    await Promise.race([cdp.send('Browser.close'), sleep(2000)]).catch(() => {})
    socket.close()
    child.kill()
    await sleep(500)
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
    } catch {
      console.error(`  could not remove ${profile}`)
    }
  }
  return { cdp, sessionId, page, close }
}

async function evaluate(page, expression) {
  const evaluation = page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  const { result, exceptionDetails } = await Promise.race([evaluation, sleep(WAIT_MS * 2).then(() => stuck(page))])
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text)
  return result.value
}

async function stuck(page) {
  const { data } = await Promise.race([page('Page.captureScreenshot', { format: 'png' }), sleep(10000).then(() => ({ data: '' }))])
  if (data) writeFileSync('bench-stuck.png', Buffer.from(data, 'base64'))
  throw new Error('the page stopped answering; see bench-stuck.png')
}

const call = (page, fn, ...params) => evaluate(page, `(${fn})(${params.map((param) => JSON.stringify(param)).join(',')})`)

const OBSERVER = `
window.__bench = { treeReady: null, longTasks: [] }
new PerformanceObserver((list) => list.getEntries().forEach((entry) => window.__bench.longTasks.push([entry.startTime, entry.duration])))
  .observe({ type: 'longtask', buffered: true })
new MutationObserver(() => {
  if (window.__bench.treeReady === null && document.querySelector('[role=treeitem]')) window.__bench.treeReady = performance.now()
}).observe(document, { childList: true, subtree: true })
`

async function load({ cdp, sessionId, page }, method, params = {}) {
  const loaded = cdp.once('Page.loadEventFired', sessionId)
  await page(method, params)
  await loaded
}

async function waitFor(page, expression) {
  const started = Date.now()
  while (!(await evaluate(page, expression))) {
    if (Date.now() - started > WAIT_MS) throw new Error(`timed out waiting for ${expression}`)
    await sleep(25)
  }
}

async function memory(page) {
  await page('HeapProfiler.collectGarbage')
  const { metrics } = await page('Performance.getMetrics')
  const metric = (name) => metrics.find((entry) => entry.name === name)?.value ?? 0
  return {
    jsHeapUsedMB: megabytes(metric('JSHeapUsedSize')),
    domNodes: metric('Nodes'),
    treeItemsInDom: await evaluate(page, `document.querySelectorAll('[role=treeitem]').length`),
  }
}

async function loadApp(browser, open) {
  await open(browser)
  await waitFor(browser.page, 'window.__bench.treeReady !== null')
  const startup = await evaluate(browser.page, `({
    treeReadyMs: window.__bench.treeReady,
    longTaskMs: window.__bench.longTasks.filter(([start]) => start < window.__bench.treeReady).reduce((sum, [, duration]) => sum + duration, 0),
  })`)
  await sleep(SETTLE_MS)
  return { ...startup, ...(await memory(browser.page)) }
}

function scrollTree(steps) {
  return (async () => {
    const tree = document.querySelector('[role=tree]')
    const distance = tree.scrollHeight - tree.clientHeight
    const frames = []
    let last = performance.now()
    for (let step = 1; step <= steps; step += 1) {
      tree.scrollTop = (distance * step) / steps
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const now = performance.now()
      frames.push(now - last)
      last = now
    }
    tree.scrollTop = 0
    return { scrollHeightPx: tree.scrollHeight, frames }
  })()
}

function searchTree(placeholder, query) {
  return (async () => {
    const input = document.querySelector(`input[placeholder="${placeholder}"]`)
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const started = performance.now()
    setValue.call(input, query)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return { query, ms: performance.now() - started, treeItemsInDom: document.querySelectorAll('[role=treeitem]').length }
  })()
}

function bigJson(megabytesWanted) {
  const items = []
  let size = 2
  for (let index = 0; size < megabytesWanted * 1024 * 1024; index += 1) {
    const item = JSON.stringify({
      id: index,
      name: `Item ${index}`,
      email: `user${index}@example.com`,
      active: index % 2 === 0,
      score: ((index * 7919) % 1000) / 10,
      tags: ['alpha', 'beta', 'gamma'].slice(0, (index % 3) + 1),
      address: { street: `${index} Main Street`, city: 'Springfield', zip: String(10000 + (index % 90000)) },
    })
    items.push(item)
    size += item.length + 1
  }
  return `[${items.join(',')}]`
}

function engineResponse(body) {
  return JSON.stringify({
    status: '200 OK', statusCode: 200, headers: [{ key: 'Content-Type', value: 'application/json' }], cookies: [],
    body, bodyEncoding: 'utf8', contentType: 'application/json', size: Buffer.byteLength(body), durationMs: 5,
    url: 'http://127.0.0.1:3901/items/1', truncated: false,
  })
}

function interceptProxy(browser, payload) {
  const encoded = Buffer.from(payload).toString('base64')
  browser.cdp.listeners.add((message) => {
    if (message.method !== 'Fetch.requestPaused' || message.sessionId !== browser.sessionId) return
    const { requestId, request } = message.params
    const isSend = new URL(request.url).pathname === '/api/proxy' && !new URL(request.url).search
    if (!isSend) {
      browser.page('Fetch.continueRequest', { requestId })
      return
    }
    browser.page('Fetch.fulfillRequest', {
      requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: encoded,
    })
  })
  return browser.page('Fetch.enable', { patterns: [{ urlPattern: '*/api/proxy*', requestStage: 'Request' }] })
}

function watchFrames() {
  window.__frames = { gaps: [], running: true, last: performance.now() }
  const loop = (now) => {
    window.__frames.gaps.push(now - window.__frames.last)
    window.__frames.last = now
    if (window.__frames.running) requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

function stopFrames() {
  window.__frames.running = false
  const { gaps } = window.__frames
  return { maxFrameMs: Math.max(...gaps), framesOver50Ms: gaps.filter((gap) => gap > 50).length }
}

function sendAndRender(waitMs) {
  return (async () => {
    const request = [...document.querySelectorAll('[role=treeitem]')].find((row) => !row.hasAttribute('aria-expanded'))
    request.querySelector('[data-row-main]').click()
    await new Promise((resolve) => setTimeout(resolve, 500))
    const send = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Send')
    const started = performance.now()
    send.click()
    const deadline = started + waitMs
    while (!document.querySelector('section[aria-label=Response]')?.textContent.includes('200 OK')) {
      if (performance.now() > deadline) throw new Error('the response did not appear')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return performance.now() - started
  })()
}

function clickAndWait(labels, waitMs) {
  return (async () => {
    const find = () => [...document.querySelectorAll('section[aria-label=Response] button')].find((candidate) => labels.includes(candidate.textContent.trim()))
    const button = find()
    if (!button) return null
    const started = performance.now()
    button.click()
    while (find()) {
      if (performance.now() - started > waitMs) throw new Error('formatting did not finish')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return performance.now() - started
  })()
}

function searchBody(query) {
  return (async () => {
    document.querySelector('section[aria-label=Response] button[aria-label^="Search body"]').click()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const input = document.querySelector('input[aria-label="Find in body"]')
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const started = performance.now()
    setValue.call(input, query)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const status = () => input.parentElement.querySelector('[aria-live]').textContent
    while (!status().includes(' of ')) {
      if (performance.now() - started > 10000) return { ms: null, status: status() }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return { ms: performance.now() - started, status: status() }
  })()
}

async function measureResponse(browser, payload, formatLabels) {
  step('sending a request with a large response')
  await interceptProxy(browser, payload)
  await call(browser.page, watchFrames)
  const renderMs = await call(browser.page, sendAndRender, WAIT_MS)
  await sleep(1000)
  const render = { renderMs, ...(await call(browser.page, stopFrames)), ...(await memory(browser.page)) }

  step('formatting the body')
  await call(browser.page, watchFrames)
  const formatMs = await call(browser.page, clickAndWait, formatLabels, WAIT_MS)
  await sleep(500)
  const format = { formatMs, ...(await call(browser.page, stopFrames)) }

  step('searching the body')
  await call(browser.page, watchFrames)
  const search = await call(browser.page, searchBody, BODY_QUERY)
  await sleep(500)
  return { render, format, search: { ...search, ...(await call(browser.page, stopFrames)) } }
}

async function run(executable, data, payload) {
  const browser = await launch(executable)
  try {
    await browser.page('Page.enable')
    await browser.page('Runtime.enable')
    await browser.page('Performance.enable')
    await browser.page('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVER })
    step('opening the app')
    const idle = await loadApp(browser, (target) => load(target, 'Page.navigate', { url: `${args.url}/web` }))
    await call(browser.page, (text) => localStorage.setItem('gostman-data', text), data)
    step('loading the large workspace')
    const large = await loadApp(browser, (target) => load(target, 'Page.reload'))
    step('scrolling the tree')
    await browser.page('Page.bringToFront')
    const scroll = await call(browser.page, scrollTree, SCROLL_STEPS)
    step('searching the tree')
    const searches = []
    for (const query of TREE_QUERIES) searches.push(await call(browser.page, searchTree, SEARCH_PLACEHOLDER, query))
    const response = await measureResponse(browser, payload, args['format-labels'].split(','))
    return {
      idle, large,
      scroll: {
        scrollHeightPx: scroll.scrollHeightPx,
        frames: scroll.frames.length,
        medianFrameMs: round(median(scroll.frames)),
        p95FrameMs: round(percentile(scroll.frames, 0.95)),
        maxFrameMs: round(Math.max(...scroll.frames)),
      },
      searches: searches.map((search) => ({ ...search, ms: round(search.ms) })),
      response,
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  if (!args.data) throw new Error('give --data with a file made by: go run ./benchmarks/workspacegen -json <file>')
  const executable = args.browser || BROWSERS.find((candidate) => existsSync(candidate))
  if (!executable) throw new Error('no Edge or Chrome found; pass --browser')
  const data = readFileSync(args.data, 'utf8')
  const parsed = JSON.parse(data)
  const body = bigJson(Number(args['json-mb']))
  const payload = engineResponse(body)
  const runs = []
  for (let index = 0; index < Number(args.runs); index += 1) {
    const result = await run(executable, data, payload)
    console.log(`run ${index + 1}: ${JSON.stringify(result)}`)
    runs.push(result)
  }
  const report = {
    date: new Date().toISOString(),
    url: args.url,
    browser: executable,
    workspace: { requests: parsed.requests.length, folders: parsed.folders.length },
    responseBodyMB: megabytes(Buffer.byteLength(body)),
    runs,
  }
  const out = args.out || `web-results-${Date.now()}.json`
  writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(`wrote ${out}`)
}

main().then(() => process.exit(0), (error) => {
  console.error(error)
  process.exit(1)
})
