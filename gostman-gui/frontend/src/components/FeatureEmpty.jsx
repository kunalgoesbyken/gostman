import { ExternalLink } from "lucide-react"
import { Button, buttonVariants } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { openExternal } from "../lib/about"
import { useFeatureAccess } from "../lib/featureAccess"
import { featureBlurb, featureDocsUrl, featureForSurface, featureTitle } from "../lib/featureIndex"
import { featureIcon } from "../lib/featureIcons"
import { FEATURES_TEXT as TEXT } from "../lib/featuresText"

function FeatureActions({ feature, hideTry }) {
  const canTry = useFeatureAccess((s) => s.canTry(feature.id, true))
  const open = useFeatureAccess((s) => s.open)
  const url = featureDocsUrl(feature)
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {canTry && !hideTry && <Button size="sm" aria-label={TEXT.tryItLabel(featureTitle(feature))} onClick={() => open(feature.id, true)}>{TEXT.tryIt}</Button>}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={TEXT.learnMoreLabel(featureTitle(feature))}
        onClick={(event) => openExternal(event, url)}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {TEXT.learnMore}
        <ExternalLink />
      </a>
    </div>
  )
}

export function FeatureEmpty({ surface, icon, title, description, className, before, hideTry }) {
  const feature = featureForSurface(surface)
  if (!feature) return <EmptyState icon={icon} title={title} description={description} className={className} />
  return (
    <EmptyState
      icon={icon ?? featureIcon(feature)}
      title={title ?? featureTitle(feature)}
      description={description ?? featureBlurb(feature)}
      className={className}
      action={(
        <div className="flex flex-col items-center gap-2">
          {before}
          <FeatureActions feature={feature} hideTry={hideTry} />
        </div>
      )}
    />
  )
}
