import { ExternalLink, MonitorDown } from "lucide-react"
import { buttonVariants } from "./ui/button"
import { DialogBody } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { DIALOG_TEXT } from "../lib/dialogText"
import { RELEASES_URL } from "../lib/siteLinks"

function DownloadLink() {
  return (
    <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
      {DIALOG_TEXT.getDesktopApp}
      <ExternalLink />
    </a>
  )
}

export function DesktopOnly({ title, description }) {
  return (
    <DialogBody>
      <EmptyState icon={MonitorDown} title={title} description={description} action={<DownloadLink />} />
    </DialogBody>
  )
}
