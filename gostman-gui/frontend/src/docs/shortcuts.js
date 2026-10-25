const EDITABLE = 'input, textarea, select, [contenteditable="true"]'

const isSearchShortcut = (event) => (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k"

const isSlash = (event) => event.key === "/" && !event.ctrlKey && !event.metaKey && !event.target.closest?.(EDITABLE)

export function watchSearchShortcut(open) {
  const onKeyDown = (event) => {
    if (!isSearchShortcut(event) && !isSlash(event)) return
    event.preventDefault()
    open()
  }
  window.addEventListener("keydown", onKeyDown)
  return () => window.removeEventListener("keydown", onKeyDown)
}
