import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { ChevronDown, ChevronRight } from "../landing/icons"
import { DOCS_TEXT } from "../../lib/docsText"
import { classes, keepVisible } from "../../docs/classes"
import { parseNavState, readNavState, serverNavState, subscribeNavState, toggleNavEntry } from "../../docs/navState"

const ROW = "flex min-w-0 flex-1 items-center rounded-md px-3 py-1.5 text-sm transition-colors"
const IDLE = "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
const CURRENT = "bg-muted font-medium text-foreground"

function useNavState() {
  const text = useSyncExternalStore(subscribeNavState, readNavState, serverNavState)
  return useMemo(() => parseNavState(text), [text])
}

function Outline({ id, items, hidden }) {
  return (
    <ul id={id} hidden={hidden} className="mb-1 ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
      {items.map((child) => (
        <li key={child.href}>
          <a href={child.href} className={classes("block rounded-md px-2 py-1 text-[0.8125rem] leading-snug", IDLE)}>
            {child.text}
          </a>
        </li>
      ))}
    </ul>
  )
}

function PageItem({ item, currentHref, state, id }) {
  const isCurrent = item.href === currentHref
  const open = state.pages[item.href] ?? isCurrent
  const outlineId = `${id}-sections`

  return (
    <li>
      <div className="flex items-center gap-0.5">
        <a href={item.href} aria-current={isCurrent ? "page" : undefined} className={classes(ROW, isCurrent ? CURRENT : IDLE)}>
          {item.label}
        </a>
        {item.children ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={outlineId}
            aria-label={DOCS_TEXT.showSections(item.label)}
            onClick={() => toggleNavEntry("pages", item.href, !open)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <ChevronRight className={classes("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
          </button>
        ) : null}
      </div>
      {item.children ? <Outline id={outlineId} items={item.children} hidden={!open} /> : null}
    </li>
  )
}

function Group({ group, currentHref, state, id }) {
  const open = state.groups[group.title] ?? true
  const listId = `${id}-pages`

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => toggleNavEntry("groups", group.title, !open)}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {group.title}
        <ChevronDown className={classes("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
      </button>
      <ul id={listId} hidden={!open} className="mt-0.5 space-y-0.5">
        {group.items.map((item, index) => (
          <PageItem key={item.href} item={item} currentHref={currentHref} state={state} id={`${id}-${index}`} />
        ))}
      </ul>
    </li>
  )
}

export function DocsSidebar({ nav, currentHref, prefix, onNavigate }) {
  const state = useNavState()
  const ref = useRef(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = ref.current?.closest("[data-scroll-container]")
      keepVisible(container, ref.current?.querySelector('[aria-current="page"]'))
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <nav ref={ref} aria-label={DOCS_TEXT.navLabel} onClick={onNavigate}>
      <ul className="space-y-4">
        {nav.map((group, index) => (
          <Group key={group.title} group={group} currentHref={currentHref} state={state} id={`${prefix}-${index}`} />
        ))}
      </ul>
    </nav>
  )
}
