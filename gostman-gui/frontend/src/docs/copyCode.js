import { DOCS_TEXT } from "../lib/docsText"

const RESET_AFTER_MS = 2000

function label(button, text) {
  button.setAttribute("aria-label", text)
  button.setAttribute("title", text)
}

async function copy(button, onCopied) {
  const code = button.closest(".docs-code")?.querySelector("code")?.textContent ?? ""
  try {
    await navigator.clipboard.writeText(code)
  } catch {
    return
  }
  button.dataset.copied = "true"
  label(button, DOCS_TEXT.code.copied)
  onCopied(DOCS_TEXT.code.copied)
  setTimeout(() => {
    delete button.dataset.copied
    label(button, DOCS_TEXT.code.copy)
    onCopied("")
  }, RESET_AFTER_MS)
}

export function watchCodeCopy(onCopied) {
  const onClick = (event) => {
    const button = event.target.closest?.("[data-copy-code]")
    if (button) copy(button, onCopied)
  }
  document.addEventListener("click", onClick)
  return () => document.removeEventListener("click", onClick)
}
