import { Button } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { toolWindow } from "../lib/dialogWindows"
import { useFeatureAccess } from "../lib/featureAccess"
import { featureBlurb, featureById, featureTitle } from "../lib/featureIndex"
import { FEATURES_TEXT as TEXT } from "../lib/featuresText"
import { latestRelease, releasesBetween } from "../lib/releaseNotes"
import { APP_VERSION } from "../lib/appVersion"
import { useAppStore } from "../store/appStore"

const WHATS_NEW_WINDOW = toolWindow("whats-new", "compact")

function Release({ release, canTry, onTry }) {
  const features = release.ids.map(featureById).filter(Boolean)
  return (
    <section aria-label={TEXT.whatsNewIntro(release.version)} className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold">{TEXT.whatsNewIntro(release.version)}</h3>
      {features.length === 0 ? (
        <p className="text-xs text-muted-foreground">{TEXT.whatsNewNothing}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {features.map((feature) => (
            <li key={feature.id} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{featureTitle(feature)}</p>
                <p className="text-xs text-muted-foreground">{featureBlurb(feature)}</p>
              </div>
              {canTry(feature.id) && <Button size="sm" variant="outline" aria-label={TEXT.tryItLabel(featureTitle(feature))} onClick={() => onTry(feature.id)}>{TEXT.tryIt}</Button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function WhatsNewDialog({ onClose }) {
  const seenVersion = useAppStore((s) => s.seenVersion)
  const openExplore = useAppStore((s) => s.openExplore)
  const canTry = useFeatureAccess((s) => s.canTry)
  const open = useFeatureAccess((s) => s.open)
  const unseen = releasesBetween(seenVersion, APP_VERSION)
  const releases = unseen.length > 0 ? unseen : [latestRelease()]

  const tryFeature = (id) => {
    onClose()
    open(id)
  }
  const exploreAll = () => {
    onClose()
    openExplore()
  }

  return (
    <Dialog label={TEXT.whatsNewTitle} floating={WHATS_NEW_WINDOW} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{TEXT.whatsNewTitle}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex max-h-[60vh] flex-col gap-4">
        {releases.map((release) => <Release key={release.version} release={release} canTry={canTry} onTry={tryFeature} />)}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={exploreAll}>{TEXT.exploreAll}</Button>
        <Button onClick={onClose}>{TEXT.close}</Button>
      </DialogFooter>
    </Dialog>
  )
}
