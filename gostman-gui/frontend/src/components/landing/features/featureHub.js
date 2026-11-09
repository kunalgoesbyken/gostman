import { GROUPS } from "../../../lib/featureCatalog"
import { featureBlurb, featureTitle, groupTitle, platformLabel, shownFeatures } from "../../../lib/featureIndex"
import { featureIcon } from "../../../lib/featureIcons"
import { docPath } from "../../../docs/manifest"

const runsInBrowser = (feature) => !feature.platforms || feature.platforms.includes("web")

const entryOf = (feature) => ({
  id: feature.id,
  title: featureTitle(feature),
  blurb: featureBlurb(feature),
  icon: featureIcon(feature),
  availability: feature.platforms ? platformLabel(feature) : "",
  href: docPath(feature.docs),
})

export function featureHub() {
  const features = shownFeatures()
  const groups = GROUPS.map((id) => ({
    id,
    title: groupTitle(id),
    entries: features.filter((feature) => feature.group === id).map(entryOf),
  })).filter((group) => group.entries.length > 0)
  return {
    groups,
    total: features.length,
    inBrowser: features.filter(runsInBrowser).length,
  }
}
