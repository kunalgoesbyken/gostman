import { MonitorDown } from "lucide-react"
import { buttonVariants } from "./ui/button"
import { DialogBody } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { CopyTextButton } from "./CopyTextButton"
import { LearnMore } from "./LearnMore"
import { featureBlurb, featureById, featureToolLabel, webAlternative } from "../lib/featureIndex"
import { FEATURES_TEXT as TEXT } from "../lib/featuresText"
import { downloadFor, downloadUrl } from "./landing/downloads"
import { useBrowserOs } from "../hooks/useBrowserOs"
import { RELEASES_URL } from "../lib/siteLinks"

function DownloadLink() {
  const os = useBrowserOs()
  const download = downloadFor(os)
  const link = download ? { href: downloadUrl(download) } : { href: RELEASES_URL, target: "_blank", rel: "noopener noreferrer" }
  return (
    <a {...link} className={buttonVariants({ size: "sm" })}>
      <MonitorDown />
      {TEXT.getDesktop}
    </a>
  )
}

function TerminalLine({ command }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-xs text-muted-foreground">{TEXT.cliLine}</p>
      <div className="flex items-center gap-2">
        <code dir="ltr" className="rounded bg-muted px-2 py-1 font-mono text-xs">{command}</code>
        <CopyTextButton text={command} />
      </div>
    </div>
  )
}

export function DesktopOnlyDetails({ featureId, showsPurpose = false }) {
  const feature = featureById(featureId)
  return (
    <div role="status" className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm font-medium">{TEXT.desktopOnlyTitle(featureToolLabel(feature))}</p>
      {showsPurpose && <p className="max-w-prose text-xs text-muted-foreground">{featureBlurb(feature)}</p>}
      <p className="max-w-prose text-xs text-muted-foreground">{webAlternative(feature) ?? TEXT.desktopOnlyBody}</p>
      {feature.command && <TerminalLine command={feature.command} />}
      <div className="flex flex-wrap justify-center gap-2">
        <DownloadLink />
        <LearnMore feature={feature} />
      </div>
    </div>
  )
}

export function DesktopOnly({ featureId, title, description }) {
  if (featureId) {
    return (
      <DialogBody className="flex items-center justify-center">
        <DesktopOnlyDetails featureId={featureId} />
      </DialogBody>
    )
  }
  return (
    <DialogBody>
      <EmptyState icon={MonitorDown} title={title} description={description} action={<DownloadLink />} />
    </DialogBody>
  )
}
