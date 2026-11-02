import { featureBlurb, featureKeywords, featureTitle, isMissingHere, isNewFeature, shownFeatures } from './featureIndex'
import { featureIcon } from './featureIcons'
import { FEATURES_TEXT } from './featuresText'
import { isDesktopApp } from './platform'

export function featureCommands(seenVersion) {
  const isDesktop = isDesktopApp()
  return shownFeatures().map((feature) => ({
    id: `feature-${feature.id}`,
    label: featureTitle(feature),
    description: featureBlurb(feature),
    keywords: featureKeywords(feature),
    icon: featureIcon(feature),
    action: 'openFeature',
    payload: feature.id,
    tag: isMissingHere(feature, isDesktop) ? FEATURES_TEXT.platformDesktop : '',
    isNew: isNewFeature(feature, seenVersion),
    onlyWhenSearching: !(feature.palette || feature.tool),
  }))
}
