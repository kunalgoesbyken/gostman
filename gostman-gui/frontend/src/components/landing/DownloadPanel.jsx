import { useState } from "react"
import { Button, buttonVariants } from "../ui/button"
import { cn } from "../../lib/utils"
import { detectBrowserOs } from "../../lib/detectOs"
import { Download, Globe } from "./icons"
import { DOWNLOADS, downloadFor, downloadUrl, groupByOs, isExternal } from "./downloads"

const NAME_COLUMN = "w-20 shrink-0 font-medium"

function DownloadRow({ download }) {
  const external = isExternal(download)
  return (
    <li>
      <a
        href={downloadUrl(download)}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className="group flex min-h-10 items-center justify-between gap-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {download.note}
        <span className="font-mono text-xs group-hover:text-foreground">{download.kind}</span>
      </a>
    </li>
  )
}

function DownloadGroup({ group }) {
  return (
    <li className="flex gap-4 border-t border-border/30 py-0.5 text-sm">
      <span className={cn(NAME_COLUMN, "py-2.5")}>{group.name}</span>
      <ul className="min-w-0 flex-1">
        {group.downloads.map((download) => (
          <DownloadRow key={download.kind} download={download} />
        ))}
      </ul>
    </li>
  )
}

export function DownloadPanel({ onGetStarted }) {
  const [os] = useState(detectBrowserOs)
  const primary = downloadFor(os)
  const others = DOWNLOADS.filter((download) => download !== primary)

  return (
    <aside aria-labelledby="download-heading" className="border-t border-border/60 pt-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
      <h3 id="download-heading" className="text-lg font-medium tracking-tight">
        Get Gostman
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Free, open source and without an account.</p>

      {primary ? (
        <a href={downloadUrl(primary)} className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full justify-between gap-3")}>
          <span className="inline-flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download for {primary.name}
          </span>
          <span className="font-mono text-xs opacity-80">{primary.kind}</span>
        </a>
      ) : (
        <Button size="lg" className="mt-6 w-full gap-2" onClick={onGetStarted}>
          <Globe className="h-4 w-4" />
          Open the web version
        </Button>
      )}

      <p className="mb-1 mt-6 text-xs uppercase tracking-wide text-muted-foreground">{primary ? "Other downloads" : "Desktop downloads"}</p>
      <ul>
        {groupByOs(others).map((group) => (
          <DownloadGroup key={group.os} group={group} />
        ))}
      </ul>

      {primary ? (
        <button
          type="button"
          onClick={onGetStarted}
          className="group flex min-h-11 w-full items-center gap-4 border-t border-border/30 py-3 text-left text-sm transition-colors hover:text-foreground"
        >
          <span className={NAME_COLUMN}>Web</span>
          <span className="flex-1 text-muted-foreground group-hover:text-foreground">Runs in this browser</span>
          <Globe className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </button>
      ) : null}
    </aside>
  )
}
