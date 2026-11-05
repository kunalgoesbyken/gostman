import { useAppStore } from "../store/appStore"
import { rememberedSidebarWidth, sidebarWidthStyle } from "../lib/layout"
import { AppSkeletonFrame } from "./AppSkeletonFrame"

export function AppSkeleton() {
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  return <AppSkeletonFrame sidebar={isSidebarOpen} sidebarStyle={sidebarWidthStyle(rememberedSidebarWidth())} />
}
