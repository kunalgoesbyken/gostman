import { whenIdle, whenLoadedAndIdle } from "./idle.js"

export const ROUTE_PREFETCH_ID = "route-prefetch"
export const EDITOR_PREFETCH_ID = "editor-prefetch"

function releasePrefetchLinks(id) {
  const template = document.getElementById(id)
  if (!template) return false
  document.head.append(template.content)
  template.remove()
  return true
}

export const prefetchRoutesWhenIdle = () => whenLoadedAndIdle(() => releasePrefetchLinks(ROUTE_PREFETCH_ID))

export const prefetchEditorWhenIdle = (load) =>
  whenIdle(() => {
    if (!releasePrefetchLinks(EDITOR_PREFETCH_ID)) load()
  })
