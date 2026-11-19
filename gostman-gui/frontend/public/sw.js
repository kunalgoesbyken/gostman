const CACHE_PREFIX = 'gostman-shell-'
const CACHE_NAME = CACHE_PREFIX + '__BUILD_ID__'
const SHELL_URL = '/'
const BUILD_ASSETS = __BUILD_ASSETS__
const LATER_ASSETS = __LATER_ASSETS__
const WARM_MESSAGE = 'warm-later-assets'
const STATIC_FILES = ['/manifest.webmanifest', '/theme-boot.js', '/favicon-32.png', '/icon-192.png', '/icon-512.png']
const PRECACHE = [SHELL_URL, ...STATIC_FILES, ...BUILD_ASSETS]
const API_PREFIX = '/api/'
const ASSET_PREFIX = '/assets/'

let warming = null

const isCacheable = (url) => url.origin === self.location.origin && !url.pathname.startsWith(API_PREFIX)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  )
})

async function warmLaterAssets() {
  const cache = await caches.open(CACHE_NAME)
  for (const asset of LATER_ASSETS) {
    if (!(await cache.match(asset))) await cache.add(new Request(asset, { priority: 'low' }))
  }
}

self.addEventListener('message', (event) => {
  if (event.data !== WARM_MESSAGE) return
  warming ??= warmLaterAssets().catch(() => {}).finally(() => { warming = null })
  event.waitUntil(warming)
})

async function cachedAsset(request) {
  const cache = await caches.open(CACHE_NAME)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

async function freshStatic(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw error
  }
}

async function navigation(request) {
  try {
    const response = await fetch(request)
    if (response.ok && new URL(request.url).pathname === SHELL_URL && !new URL(request.url).search) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(SHELL_URL, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(SHELL_URL, { cacheName: CACHE_NAME })
    if (cached) return cached
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (!isCacheable(url)) return
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request))
    return
  }
  if (STATIC_FILES.includes(url.pathname)) {
    event.respondWith(freshStatic(request))
    return
  }
  if (url.pathname.startsWith(ASSET_PREFIX) && !url.pathname.startsWith('/assets/sandbox.worker.')) {
    event.respondWith(cachedAsset(request))
  }
})
