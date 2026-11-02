import { useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, MonitorDown, Sparkles } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, buttonVariants } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { SearchField } from "./SearchField"
import { openExternal } from "../lib/about"
import { useFeatureAccess } from "../lib/featureAccess"
import { featureBlurb, featureDocsUrl, featureTitle, groupTitle, isMissingHere, isNewFeature, searchFeatures, shownFeatures } from "../lib/featureIndex"
import { featureIcon } from "../lib/featureIcons"
import { FEATURES_TEXT as TEXT } from "../lib/featuresText"
import { GROUPS } from "../lib/featureCatalog"
import { isDesktopApp } from "../lib/platform"
import { RELEASES_URL } from "../lib/siteLinks"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

const EXPLORE_WINDOW = { id: "explore", width: 820, height: 640, minWidth: 420, minHeight: 360 }

const platformLabel = (feature) => {
  if (!feature.platforms) return ""
  if (feature.platforms.includes("cli")) return TEXT.platformCli
  return feature.platforms.includes("desktop") ? TEXT.platformDesktop : TEXT.platformWeb
}

function GroupTabs({ group, onChange }) {
  const choices = ["", ...GROUPS]
  return (
    <div role="group" aria-label={TEXT.groupsLabel} className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
      {choices.map((choice) => (
        <Button key={choice || "all"} size="sm" variant={choice === group ? "secondary" : "ghost"} aria-pressed={choice === group} onClick={() => onChange(choice)} className="shrink-0">
          {choice ? groupTitle(choice) : TEXT.allGroups}
        </Button>
      ))}
    </div>
  )
}

function LearnMore({ feature }) {
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

function FeatureRow({ feature, isFocused, scrollsToFocus, seenVersion, canTry, onTry }) {
  const Icon = featureIcon(feature)
  const ref = useRef(null)
  const tag = platformLabel(feature)
  const title = featureTitle(feature)
  useEffect(() => {
    if (isFocused && scrollsToFocus) ref.current?.scrollIntoView({ block: "center" })
  }, [isFocused, scrollsToFocus])
  return (
    <li ref={ref} data-feature={feature.id} className={cn("flex items-center gap-3 rounded-md border border-transparent px-2 py-2", isFocused && "border-border bg-accent")}>
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-60">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            {title}
            {isNewFeature(feature, seenVersion) && <Badge variant="success">{TEXT.newBadge}</Badge>}
            {tag && <Badge>{tag}</Badge>}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{featureBlurb(feature)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canTry && <Button size="sm" variant="outline" aria-label={TEXT.tryItLabel(title)} onClick={() => onTry(feature.id)}>{TEXT.tryIt}</Button>}
          <LearnMore feature={feature} />
        </div>
      </div>
    </li>
  )
}

function DesktopOnlyNotice({ feature }) {
  return (
    <div role="status" className="mb-3 flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-xs font-medium">{TEXT.desktopOnlyTitle(featureTitle(feature))}</p>
      <p className="text-xs text-muted-foreground">{TEXT.desktopOnlyBody}</p>
      <div className="flex flex-wrap gap-2">
        <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm" })}>
          <MonitorDown />
          {TEXT.getDesktop}
        </a>
        <LearnMore feature={feature} />
      </div>
    </div>
  )
}

export function ExploreDialog({ onClose }) {
  const initialQuery = useAppStore((s) => s.exploreQuery)
  const focusId = useAppStore((s) => s.exploreFocus)
  const seenVersion = useAppStore((s) => s.seenVersion)
  const openWhatsNew = useAppStore((s) => s.openWhatsNew)
  const canTry = useFeatureAccess((s) => s.canTry)
  const open = useFeatureAccess((s) => s.open)
  const [query, setQuery] = useState(initialQuery)
  const [group, setGroup] = useState("")
  const features = useMemo(() => searchFeatures(query, group), [query, group])
  const focused = useMemo(() => shownFeatures().find((feature) => feature.id === focusId) ?? null, [focusId])
  const isDesktop = isDesktopApp()
  const showsNotice = focused !== null && isMissingHere(focused, isDesktop)

  return (
    <Dialog label={TEXT.title} size="lg" floating={EXPLORE_WINDOW} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{TEXT.title}</DialogTitle>
      </DialogHeader>
      <SearchField value={query} onChange={setQuery} placeholder={TEXT.searchPlaceholder} />
      <GroupTabs group={group} onChange={setGroup} />
      <DialogBody>
        {showsNotice && <DesktopOnlyNotice feature={focused} />}
        {!showsNotice && query === "" && !focused && <p className="mb-3 text-xs text-muted-foreground">{TEXT.intro}</p>}
        {features.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{TEXT.nothingMatches(query)}</p>
        ) : (
          <ul className="-mx-2 flex flex-col gap-0.5">
            {features.map((feature) => (
              <FeatureRow key={feature.id} feature={feature} isFocused={feature.id === focusId} scrollsToFocus={!showsNotice} seenVersion={seenVersion} canTry={canTry(feature.id)} onTry={open} />
            ))}
          </ul>
        )}
      </DialogBody>
      <DialogFooter>
        <span className="me-auto self-center text-xs text-muted-foreground">{TEXT.results(features.length)}</span>
        <Button variant="outline" onClick={openWhatsNew}>
          <Sparkles />
          {TEXT.whatsNewTitle}
        </Button>
        <Button onClick={onClose}>{TEXT.close}</Button>
      </DialogFooter>
    </Dialog>
  )
}
