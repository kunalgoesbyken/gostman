import { FEATURES, TOOL_GROUPS } from './featureCatalog'
import { featureIcon } from './featureIcons'
import { FEATURES_TEXT } from './featuresText'
import { featureToolLabel, isMissingHere } from './featureIndex'
import { isDesktopApp } from './platform'

const toolsIn = (group) => FEATURES
  .filter((feature) => feature.tool?.group === group)
  .sort((first, second) => first.tool.order - second.tool.order)

const platformTag = (feature, isDesktop) => {
  if (isMissingHere(feature, isDesktop)) return FEATURES_TEXT.platformDesktop
  return feature.action ? '' : FEATURES_TEXT.platformCli
}

export function toolMenuItems(open) {
  const isDesktop = isDesktopApp()
  return TOOL_GROUPS.flatMap((group) => [
    { id: `heading-${group}`, heading: true, label: FEATURES_TEXT.toolGroups[group] },
    ...toolsIn(group).map((feature) => ({
      id: feature.id,
      label: featureToolLabel(feature),
      icon: featureIcon(feature),
      detail: platformTag(feature, isDesktop),
      onSelect: () => open(feature.id),
    })),
  ])
}
