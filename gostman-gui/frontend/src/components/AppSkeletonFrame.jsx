import { PanelLeft } from "lucide-react"
import { Skeleton, SkeletonLines } from "./ui/skeleton"
import { Logo } from "./ui/logo"
import { SIDEBAR_PANE, sidebarWidthStyle } from "../lib/layout"
import { APP_TEXT } from "../lib/appText"

const DEFAULT_SIDEBAR_STYLE = sidebarWidthStyle(SIDEBAR_PANE.fallback)

function SidebarSkeleton({ style }) {
  return (
    <div className="flex w-[var(--sidebar-width)] shrink-0 flex-col border-e border-border max-md:hidden" style={style}>
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="flex h-10 shrink-0 items-center border-b border-border px-3">
        <Skeleton className="h-7 w-full" />
      </div>
      <SkeletonLines lines={6} className="gap-4" />
    </div>
  )
}

function MainSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-border px-3">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex shrink-0 flex-col gap-3 border-b border-border p-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <SkeletonLines lines={5} />
    </div>
  )
}

export function AppSkeletonFrame({ sidebar = true, sidebarStyle = DEFAULT_SIDEBAR_STYLE }) {
  return (
    <div role="status" aria-label={APP_TEXT.loading} data-app-skeleton="" className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3 max-sm:gap-2">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground rtl:[&_svg]:-scale-x-100">
          <PanelLeft className="size-4" />
        </span>
        <Logo className="h-6 w-6 max-sm:hidden" />
        <span aria-hidden="true" className="font-brand text-sm font-semibold max-sm:hidden">Gostman</span>
        <Skeleton className="ms-auto h-7 w-48 max-sm:w-20" />
      </div>
      <div className="flex min-h-0 flex-1">
        {sidebar && <SidebarSkeleton style={sidebarStyle} />}
        <MainSkeleton />
      </div>
      <div className="h-6 shrink-0 border-t border-border max-sm:h-10" />
    </div>
  )
}
