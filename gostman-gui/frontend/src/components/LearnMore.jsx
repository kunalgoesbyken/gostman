import { ExternalLink } from "lucide-react"
import { buttonVariants } from "./ui/button"
import { openExternal } from "../lib/about"
import { featureDocsUrl, featureTitle } from "../lib/featureIndex"
import { FEATURES_TEXT as TEXT } from "../lib/featuresText"

export function LearnMore({ feature }) {
  const url = featureDocsUrl(feature)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={TEXT.learnMoreLabel(featureTitle(feature))}
      onClick={(event) => openExternal(event, url)}
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      {TEXT.learnMore}
      <ExternalLink />
    </a>
  )
}
