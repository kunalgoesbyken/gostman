import { GROUPS } from "../../../lib/featureCatalog"
import { featureBlurb, featureById, featureTitle, groupTitle, platformLabel, shownFeatures } from "../../../lib/featureIndex"
import { featureIcon } from "../../../lib/featureIcons"
import { docPath } from "../../../docs/manifest"

const HIGHLIGHTS = [
  { id: "flows" },
  { id: "git-panel" },
  { id: "secret-managers" },
  { id: "mock-rules" },
  { id: "cli" },
  { id: "agents", href: "/ai-agents" },
]

const entryOf = (feature) => ({
  id: feature.id,
  title: featureTitle(feature),
  blurb: featureBlurb(feature),
  icon: featureIcon(feature),
  availability: feature.platforms ? platformLabel(feature) : "",
  href: docPath(feature.docs),
})

const highlightOf = ({ id, href }) => {
  const entry = entryOf(featureById(id))
  return href ? { ...entry, href } : entry
}

export function featureHub() {
  const features = shownFeatures()
  const groups = GROUPS.map((id) => ({
    id,
    title: groupTitle(id),
    entries: features.filter((feature) => feature.group === id).map(entryOf),
  })).filter((group) => group.entries.length > 0)
  return { highlights: HIGHLIGHTS.map(highlightOf), groups, total: features.length }
}
