import { docPath } from "../../docs/manifest"
import { FEATURES } from "../../lib/featureCatalog"
import { AI_AVAILABLE, AI_FEATURE } from "./content"
import siteFeatures from "./siteFeatures.json"

const GROUP_TITLES = [
  { id: "send", title: "Send and inspect" },
  { id: "variables", title: "Variables and secrets" },
  { id: "automate", title: "Test and automate" },
  { id: "data", title: "Your data and tools" },
]

const rowOf = (feature) => {
  const { term, page, text, brands } = siteFeatures.landing[feature.id]
  return { term, href: docPath(page), text, ...(brands && { brands }) }
}

const rowsOf = (groupId) => FEATURES
  .filter((feature) => feature.landing?.group === groupId)
  .sort((first, second) => first.landing.order - second.landing.order)
  .map(rowOf)

export const FEATURE_INDEX = GROUP_TITLES.map((group) => ({ ...group, rows: rowsOf(group.id) }))

const AI_ROW = { term: AI_FEATURE.title, href: docPath("ai"), text: AI_FEATURE.description, brands: AI_FEATURE.brands }

export const FEATURE_GROUPS = FEATURE_INDEX.map((group, index) =>
  AI_AVAILABLE && index === FEATURE_INDEX.length - 1 ? { ...group, rows: [...group.rows, AI_ROW] } : group,
)
