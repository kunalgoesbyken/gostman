import { resolve } from 'path'
import { searchForWorkspaceRoot } from 'vite'
import { findCaptures } from './captures.js'
import { LOCALES_ROOT, REPOSITORY_ROOT } from './paths.js'
import { PSEUDO_LOCALES, pseudoCatalogue } from './pseudo.js'
import { ENGLISH, fallbackSummary, languageDirectories, readCatalogue, validateCatalogues } from './validate.js'

export const LISTED_COVERAGE = 0.5
export const CAPTURES_ARE_ERRORS = true
export const LOCALE_CHUNK_PREFIX = 'locale-'

const LANGUAGES_ID = 'virtual:gostman-languages'
const LOCALE_PREFIX = 'virtual:gostman-locale/'
const RESOLVED_PREFIX = '\0'
const RESOLVED_LANGUAGES_ID = `${RESOLVED_PREFIX}gostman-languages`
const RESOLVED_LOCALE_PREFIX = `${RESOLVED_PREFIX}gostman-locale/`
const SOURCE_FILE = /\.jsx?$/
const SKIPPED_SOURCES = ['/src/lib/i18n/', '/components/landing/', '/LandingPage.jsx', '/GuidePage.jsx', '/src/guides/', '/src/lib/docs/', '/src/lib/docs.js', '/components/docs/', '/docs-main.jsx', '/src/docs/']
const CAPTURE_HINTS = ['Text', 'Intl', 'toLocale']

const isVerbose = () => process.env.GOSTMAN_I18N_VERBOSE === '1'

const withPseudo = (serving) => serving || process.env.GOSTMAN_PSEUDO_LOCALES === '1'

const cleanId = (id) => id.split('?')[0].replace(/\\/g, '/')

const isCheckedSource = (id) => id.includes('/src/') && !id.includes('/node_modules/') && SOURCE_FILE.test(id) && !SKIPPED_SOURCES.some((part) => id.includes(part))

function languageEntries(report, includePseudo) {
  const listed = Object.entries(report.coverage)
    .filter(([, coverage]) => coverage >= LISTED_COVERAGE)
    .map(([value, coverage]) => ({ value, coverage, pseudo: false }))
  const pseudo = includePseudo ? PSEUDO_LOCALES.map((value) => ({ value, coverage: 1, pseudo: true })) : []
  return [{ value: ENGLISH, coverage: 1, pseudo: false }, ...listed, ...pseudo]
}

function languagesModule(entries) {
  const loaders = entries
    .filter((entry) => entry.value !== ENGLISH)
    .map((entry) => `${JSON.stringify(entry.value)}: () => import(${JSON.stringify(`${LOCALE_PREFIX}${entry.value}`)})`)
  return `export const LANGUAGE_LIST = ${JSON.stringify(entries)}\nexport const LOCALE_LOADERS = {${loaders.join(',')}}`
}

function localeCatalogue(code) {
  if (PSEUDO_LOCALES.includes(code)) return pseudoCatalogue(readCatalogue(LOCALES_ROOT, ENGLISH), code)
  return readCatalogue(LOCALES_ROOT, code)
}

export function localesPlugin() {
  let serving = false
  let report = null

  const validate = () => {
    report = validateCatalogues(LOCALES_ROOT)
    return report
  }

  const currentReport = () => report ?? validate()

  const withLocalesChunks = (options) => {
    const previous = options.manualChunks
    const manualChunks = (id, api) => {
      if (id.startsWith(RESOLVED_LOCALE_PREFIX)) return `${LOCALE_CHUNK_PREFIX}${id.slice(RESOLVED_LOCALE_PREFIX.length)}`
      return typeof previous === 'function' ? previous(id, api) : undefined
    }
    return { ...options, manualChunks }
  }

  return {
    name: 'gostman-locales',
    enforce: 'pre',
    config: () => ({ server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), REPOSITORY_ROOT] } } }),
    configResolved(config) {
      serving = config.command === 'serve'
    },
    buildStart() {
      const { errors, warnings, ...rest } = validate()
      languageDirectories(LOCALES_ROOT).forEach((language) => this.addWatchFile(resolve(LOCALES_ROOT, language)))
      if (errors.length > 0) this.error(`Translation files have ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n${errors.join('\n')}`)
      fallbackSummary(rest).forEach((line) => this.warn(line))
      if (isVerbose()) warnings.forEach((line) => this.warn(line))
    },
    resolveId(id) {
      if (id === LANGUAGES_ID) return RESOLVED_LANGUAGES_ID
      if (id.startsWith(LOCALE_PREFIX)) return `${RESOLVED_LOCALE_PREFIX}${id.slice(LOCALE_PREFIX.length)}`
      return null
    },
    load(id) {
      if (id === RESOLVED_LANGUAGES_ID) return languagesModule(languageEntries(currentReport(), withPseudo(serving)))
      if (id.startsWith(RESOLVED_LOCALE_PREFIX)) return `export default ${JSON.stringify(localeCatalogue(id.slice(RESOLVED_LOCALE_PREFIX.length)))}`
      return null
    },
    transform(code, id) {
      const path = cleanId(id)
      if (!isCheckedSource(path) || !CAPTURE_HINTS.some((hint) => code.includes(hint))) return null
      const found = findCaptures(code, path.slice(path.indexOf('/src/') + 1))
      if (CAPTURES_ARE_ERRORS && found.length > 0) this.error(found.join('\n'))
      found.forEach((line) => this.warn(line))
      return null
    },
    outputOptions: withLocalesChunks,
    configureServer(server) {
      server.watcher.add(LOCALES_ROOT)
      const reload = (file) => {
        if (!cleanId(file).startsWith(cleanId(LOCALES_ROOT))) return
        validate()
        ;[RESOLVED_LANGUAGES_ID, ...languageDirectories(LOCALES_ROOT).concat(PSEUDO_LOCALES).map((code) => `${RESOLVED_LOCALE_PREFIX}${code}`)].forEach((id) => {
          const module = server.moduleGraph.getModuleById(id)
          if (module) server.moduleGraph.invalidateModule(module)
        })
        server.ws.send({ type: 'full-reload' })
      }
      ;['change', 'add', 'unlink'].forEach((event) => server.watcher.on(event, reload))
    },
  }
}

export const isLocaleChunk = (fileName) => fileName.startsWith(`assets/${LOCALE_CHUNK_PREFIX}`)
