import { useState } from "react"
import { X } from "lucide-react"
import { IconButton } from "./ui/button"
import { openExternal } from "../lib/about"
import { featureBlurb, featureDocsUrl, featureForSurface, featureTitle } from "../lib/featureIndex"
import { FEATURES_TEXT as TEXT } from "../lib/featuresText"
import { hiddenHints, hideHint } from "../lib/helperHints"

export function FeatureHint({ panel }) {
  const surface = `tab:${panel}`
  const [hidden, setHidden] = useState(hiddenHints)
  const feature = featureForSurface(surface)
  if (!feature || hidden.includes(surface)) return null
  const url = featureDocsUrl(feature)
  const hide = () => {
    hideHint(surface)
    setHidden(hiddenHints())
  }
  return (
    <div role="note" className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-2xs text-muted-foreground">
      <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        {featureBlurb(feature)}{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => openExternal(event, url)} className="text-primary underline-offset-2 hover:underline">
          {TEXT.learnMore}
        </a>
      </p>
      <IconButton label={TEXT.helpHideLabel(featureTitle(feature))} icon={X} size="icon-xs" onClick={hide} />
    </div>
  )
}
