import { useState } from "react"
import { Button, buttonVariants } from "../ui/button"
import { cn } from "../../lib/utils"
import { detectBrowserOs } from "../../lib/detectOs"
import { Download, Globe } from "./icons"
import { DOWNLOADS, downloadFor, downloadUrl } from "./downloads"

function DownloadRow({ download }) {
  return (
    <li>
      <a
        href={downloadUrl(download)}
        className="group flex min-h-11 items-center justify-between gap-4 border-t border-border/30 py-3 text-sm transition-colors hover:text-foreground"
      >
        <span>
          <span className="font-medium">{download.name}</span>
          <span className="ml-2 text-muted-foreground">{download.note}</span>
        </span>
        <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">{download.kind}</span>
      </a>
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
        {others.map((download) => (
          <DownloadRow key={download.file} download={download} />
        ))}
      </ul>

      {primary ? (
        <button
          type="button"
          onClick={onGetStarted}
          className="group flex min-h-11 w-full items-center justify-between gap-4 border-t border-border/30 py-3 text-left text-sm transition-colors hover:text-foreground"
        >
          <span>
            <span className="font-medium">Web version</span>
            <span className="ml-2 text-muted-foreground">Runs in this browser</span>
          </span>
          <Globe className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </button>
      ) : null}
    </aside>
  )
}
