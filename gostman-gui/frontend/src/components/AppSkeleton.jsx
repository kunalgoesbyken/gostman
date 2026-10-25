import { Skeleton, SkeletonLines } from "./ui/skeleton"
import { useAppStore } from "../store/appStore"
import { rememberedSidebarWidth, sidebarWidthStyle } from "../lib/layout"
import { APP_TEXT } from "../lib/appText"

function SidebarSkeleton() {
  return (
    <div className="flex w-[var(--sidebar-width)] shrink-0 flex-col border-r border-border max-md:hidden" style={sidebarWidthStyle(rememberedSidebarWidth())}>
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

export function AppSkeleton() {
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  return (
    <div role="status" aria-label={APP_TEXT.loading} className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Skeleton className="h-6 w-6" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-7 w-48 max-sm:w-20" />
      </div>
      <div className="flex min-h-0 flex-1">
        {isSidebarOpen && <SidebarSkeleton />}
        <MainSkeleton />
      </div>
      <div className="h-6 shrink-0 border-t border-border max-sm:h-10" />
    </div>
  )
}
