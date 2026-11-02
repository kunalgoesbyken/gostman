import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACTIONS, FEATURES, GROUPS, PLATFORMS, SURFACES } from '../src/lib/featureCatalog.js'
import { RELEASES } from '../src/lib/releaseNotes.js'
import { isValidVersion } from '../src/lib/versions.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(here, '../../..')
const docsRoot = path.join(repository, 'docs')
const words = JSON.parse(fs.readFileSync(path.join(repository, 'locales/en/features.json'), 'utf8'))
const siteFeatures = JSON.parse(fs.readFileSync(path.join(here, '../src/components/landing/siteFeatures.json'), 'utf8'))

const problems = []
const report = (message) => problems.push(message)

const camelId = (id) => id.replace(/-([a-z0-9])/g, (match, letter) => letter.toUpperCase())
const slugOf = (heading) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')

const anchorsOf = (page) => {
  const file = path.join(docsRoot, `${page}.md`)
  if (!fs.existsSync(file)) return null
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  let fenced = false
  const anchors = new Set()
  for (const line of lines) {
    if (line.startsWith('```')) fenced = !fenced
    const heading = !fenced && /^#{1,6}\s+(.*)$/.exec(line)
    if (heading) anchors.add(slugOf(heading[1].replace(/[`*_]/g, '')))
  }
  return anchors
}

const seen = new Set()
const surfaces = new Map()

for (const feature of FEATURES) {
  const where = `feature ${feature.id}`
  if (!/^[a-z][a-z0-9-]*$/.test(feature.id)) report(`${where}: the id must be lowercase words joined by hyphens`)
  if (seen.has(feature.id)) report(`${where}: the id is used twice`)
  seen.add(feature.id)
  if (!GROUPS.includes(feature.group)) report(`${where}: unknown group "${feature.group}"`)
  for (const platform of feature.platforms ?? []) if (!PLATFORMS.includes(platform)) report(`${where}: unknown platform "${platform}"`)
  if (feature.platforms && feature.platforms.length === 0) report(`${where}: platforms is empty; leave it out for both`)
  if (feature.since !== undefined && !isValidVersion(feature.since)) report(`${where}: since "${feature.since}" is not a version`)

  const text = words.featureWords?.[camelId(feature.id)]
  for (const key of ['title', 'blurb', 'synonyms']) {
    if (typeof text?.[key] !== 'string' || text[key].trim() === '') report(`${where}: featureWords.${camelId(feature.id)}.${key} is missing in locales/en/features.json`)
  }

  if (feature.docs === undefined) report(`${where}: docs is missing`)
  else {
    const [page, anchor] = feature.docs.split('#')
    const anchors = anchorsOf(page)
    if (anchors === null) report(`${where}: docs/${page}.md does not exist`)
    else if (anchor !== undefined && !anchors.has(anchor)) report(`${where}: docs/${page}.md has no heading for #${anchor}`)
  }

  const known = feature.action ? ACTIONS[feature.action.type] : undefined
  if (feature.action && (!known || !known.includes(feature.action.id))) report(`${where}: unknown action ${feature.action.type}:${feature.action.id}`)
  if (feature.sample !== undefined && !ACTIONS.sample.includes(feature.sample)) report(`${where}: unknown sample "${feature.sample}"`)

  for (const surface of feature.empty ?? []) {
    if (!SURFACES.includes(surface)) report(`${where}: unknown surface "${surface}"`)
    if (surfaces.has(surface)) report(`${where}: surface "${surface}" is already used by ${surfaces.get(surface)}`)
    surfaces.set(surface, feature.id)
  }

  if (feature.landing && !siteFeatures.landing?.[feature.id]) report(`${where}: landing is set but landing/siteFeatures.json has no landing.${feature.id}`)
  if (feature.compare && !siteFeatures.compare?.[feature.id]) report(`${where}: compare is set but landing/siteFeatures.json has no compare.${feature.id}`)
}

const ids = new Set(FEATURES.map((feature) => feature.id))
for (const section of ['landing', 'compare']) {
  for (const id of Object.keys(siteFeatures[section] ?? {})) {
    const feature = FEATURES.find((candidate) => candidate.id === id)
    if (!feature || !feature[section]) report(`landing/siteFeatures.json: ${section}.${id} has no catalog entry with ${section} set`)
  }
}

for (const wordId of Object.keys(words.featureWords ?? {})) {
  if (!FEATURES.some((feature) => camelId(feature.id) === wordId)) report(`locales/en/features.json: featureWords.${wordId} has no catalog entry`)
}

for (const release of RELEASES) {
  if (!isValidVersion(release.version)) report(`release ${release.version}: not a version`)
  for (const id of release.ids) {
    if (!ids.has(id)) report(`release ${release.version}: unknown feature "${id}"`)
    else if (FEATURES.find((feature) => feature.id === id).since !== release.version) report(`release ${release.version}: ${id} has a different since`)
  }
}
for (const feature of FEATURES) {
  if (feature.since && !RELEASES.some((release) => release.version === feature.since && release.ids.includes(feature.id))) report(`feature ${feature.id}: since ${feature.since} is not listed in lib/releaseNotes.js`)
}

problems.forEach((line) => console.error(`error  ${line}`))
console.log(`Catalog: ${FEATURES.length} features, ${RELEASES.length} releases.`)
console.log(problems.length === 0 ? 'Feature catalog is valid.' : `${problems.length} problem${problems.length === 1 ? '' : 's'} found.`)
process.exit(problems.length === 0 ? 0 : 1)
