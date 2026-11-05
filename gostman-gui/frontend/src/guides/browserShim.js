const VIEWPORT_WIDTH = Number(process.argv[2]) || 1366
const VIEWPORT_HEIGHT = 900

const noop = () => {}

function memoryStorage() {
  const entries = new Map()
  return {
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
    clear: () => entries.clear(),
    key: (index) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size
    },
  }
}

const element = () => ({
  style: { setProperty: noop, removeProperty: noop },
  dataset: {},
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  setAttribute: noop,
  removeAttribute: noop,
  getAttribute: () => null,
  appendChild: noop,
  append: noop,
  remove: noop,
  addEventListener: noop,
  removeEventListener: noop,
})

const widthCondition = /\((min|max)-width:\s*(\d+)px\)/

function matchesCondition(condition) {
  const width = condition.match(widthCondition)
  if (!width) return false
  return width[1] === "min" ? VIEWPORT_WIDTH >= Number(width[2]) : VIEWPORT_WIDTH <= Number(width[2])
}

const matches = (query) => query.split(/\s+and\s+/).every(matchesCondition)

const mediaQuery = (query) => ({
  media: query,
  matches: matches(query),
  addEventListener: noop,
  removeEventListener: noop,
  addListener: noop,
  removeListener: noop,
})

globalThis.window = globalThis

Object.assign(globalThis, {
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: noop,
  matchMedia: mediaQuery,
  localStorage: memoryStorage(),
  sessionStorage: memoryStorage(),
  location: new URL("https://gostman.com/web"),
  history: { pushState: noop, replaceState: noop, state: null },
  innerWidth: VIEWPORT_WIDTH,
  innerHeight: VIEWPORT_HEIGHT,
  devicePixelRatio: 1,
  requestAnimationFrame: (task) => setTimeout(task, 0),
  cancelAnimationFrame: clearTimeout,
  requestIdleCallback: (task) => setTimeout(task, 0),
  cancelIdleCallback: clearTimeout,
  document: {
    documentElement: element(),
    head: element(),
    body: element(),
    createElement: element,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    visibilityState: "visible",
    readyState: "loading",
    fonts: { ready: Promise.resolve(), check: () => false },
  },
})

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { userAgent: "Mozilla/5.0", platform: "Win32", language: "en-US", languages: ["en-US"], onLine: true },
})
