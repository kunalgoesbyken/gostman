import * as React from "react"
import { inlineStart } from "../../hooks/direction"
import { ChevronDown } from "lucide-react"
import { ContextMenu } from "./ContextMenu"
import { ORIENTATION, moveFocus } from "../../lib/rovingFocus"
import { scrollIntoStrip } from "../../lib/scrollIntoStrip"
import { visibleIndexes } from "../../lib/tabOverflow"
import { cn } from "../../lib/utils"

export const TAB_KEYS = { selector: "[role=tab]", orientation: ORIENTATION.horizontal, activate: true }

const TRIGGER_CLASS = "inline-flex min-w-6 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pt-0.5 text-xs font-medium"
const IDLE_TRIGGER_CLASS = "border-transparent text-muted-foreground hover:text-foreground"
const STRIP_GAP_PX = 16

const TabsContext = React.createContext({ value: "", setValue: () => {}, idOf: () => undefined })

function Tabs({ value, onValueChange, children, className }) {
  const baseId = React.useId()
  const context = React.useMemo(
    () => ({ value, setValue: onValueChange, idOf: (part, tab) => `${baseId}${part}-${tab}` }),
    [value, onValueChange, baseId]
  )
  return (
    <TabsContext.Provider value={context}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, label, children, onContextMenu }) {
  return (
    <div
      role="tablist"
      onContextMenu={onContextMenu}
      aria-label={label}
      onKeyDown={(event) => moveFocus(event, TAB_KEYS)}
      className={cn("flex h-full min-w-0 items-stretch gap-4 overflow-x-auto scrollbar-none", className)}
    >
      {children}
    </div>
  )
}

function TabsTrigger({ className, value, children }) {
  const { value: currentValue, setValue, idOf } = React.useContext(TabsContext)
  const triggerRef = React.useRef(null)
  const isActive = currentValue === value

  React.useEffect(() => {
    if (isActive) scrollIntoStrip(triggerRef.current)
  }, [isActive])

  return (
    <button
      ref={triggerRef}
      type="button"
      role="tab"
      id={idOf("tab", value)}
      aria-selected={isActive}
      aria-controls={isActive ? idOf("panel", value) : undefined}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setValue(value)}
      className={cn(TRIGGER_CLASS, isActive ? "border-primary text-foreground" : IDLE_TRIGGER_CLASS, className)}
    >
      {children}
    </button>
  )
}

function MoreContent({ label, marked }) {
  return (
    <>
      {label}
      {marked && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />}
      <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
    </>
  )
}

const widthOf = (element) => element.getBoundingClientRect().width

const paddingOf = (element) => {
  const style = getComputedStyle(element)
  return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
}

const sameLayout = (current, next) => current?.full === next.full && current.shown.join() === next.shown.join()

function useFittedIndexes(items, activeValue) {
  const stripRef = React.useRef(null)
  const measureRef = React.useRef(null)
  const [layout, setLayout] = React.useState(null)
  const layoutRef = React.useRef(null)
  const activeIndex = items.findIndex((item) => item.value === activeValue)

  const fit = React.useCallback(() => {
    const strip = stripRef.current
    const measured = Array.from(measureRef.current?.children ?? [], widthOf)
    if (!strip || measured.length === 0) return
    const widths = measured.slice(0, -1)
    const padding = paddingOf(strip)
    const full = widths.reduce((total, width) => total + width, padding) + STRIP_GAP_PX * Math.max(widths.length - 1, 0)
    const shown = visibleIndexes({ widths, moreWidth: measured.at(-1), room: widthOf(strip) - padding, gap: STRIP_GAP_PX, activeIndex })
    const next = { full, shown }
    if (sameLayout(layoutRef.current, next)) return
    layoutRef.current = next
    setLayout(next)
  }, [activeIndex])

  React.useLayoutEffect(fit)

  React.useEffect(() => {
    const observer = new ResizeObserver(fit)
    observer.observe(stripRef.current)
    observer.observe(measureRef.current)
    return () => observer.disconnect()
  }, [fit])

  const shown = layout?.shown ?? items.map((_, index) => index)
  return { stripRef, measureRef, fullWidth: layout?.full, visible: shown.filter((index) => index < items.length) }
}

function useFocusAfterPick(idOf) {
  const pickedRef = React.useRef("")

  React.useEffect(() => {
    const tab = pickedRef.current && document.getElementById(idOf("tab", pickedRef.current))
    if (!tab) return
    pickedRef.current = ""
    tab.focus()
  })

  return pickedRef
}

function OverflowTabsList({ className, label, items, moreLabel, moreHint }) {
  const { value, setValue, idOf } = React.useContext(TabsContext)
  const { stripRef, measureRef, fullWidth, visible } = useFittedIndexes(items, value)
  const [menu, setMenu] = React.useState(null)
  const pickedRef = useFocusAfterPick(idOf)
  const closeMenu = React.useCallback(() => setMenu(null), [])
  const hidden = items.filter((_, index) => !visible.includes(index))
  const isMarked = hidden.some((item) => item.marked)

  const toggleMenu = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setMenu(menu ? null : { x: inlineStart(rect), y: rect.bottom })
  }

  const pick = (tab) => {
    pickedRef.current = tab
    setValue(tab)
  }

  const menuItems = hidden.map((item) => ({ id: item.value, label: item.label, detail: item.detail, onSelect: () => pick(item.value) }))

  return (
    <div ref={stripRef} style={{ flexBasis: fullWidth }} className={cn("relative flex h-full min-w-0 shrink items-stretch gap-4", className)}>
      <div role="tablist" aria-label={label} onKeyDown={(event) => moveFocus(event, TAB_KEYS)} className="flex h-full min-w-0 items-stretch gap-4">
        {visible.map((index) => <TabsTrigger key={items[index].value} value={items[index].value}>{items[index].content}</TabsTrigger>)}
      </div>
      {hidden.length > 0 && (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menu !== null}
          title={moreHint}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={toggleMenu}
          className={cn(TRIGGER_CLASS, IDLE_TRIGGER_CLASS)}
        >
          <MoreContent label={moreLabel} marked={isMarked} />
        </button>
      )}
      <div ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex h-0 w-max overflow-hidden">
        {items.map((item) => <span key={item.value} className={TRIGGER_CLASS}>{item.content}</span>)}
        <span className={TRIGGER_CLASS}><MoreContent label={moreLabel} marked /></span>
      </div>
      {menu && <ContextMenu position={menu} title="" items={menuItems} onClose={closeMenu} />}
    </div>
  )
}

function TabsContent({ className, value, children }) {
  const { value: currentValue, idOf } = React.useContext(TabsContext)
  if (currentValue !== value) return null
  return <div role="tabpanel" id={idOf("panel", value)} aria-labelledby={idOf("tab", value)} className={className}>{children}</div>
}

const COUNT_TONES = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
}

function TabCount({ tone = "neutral", children }) {
  return <span className={cn("rounded px-1 font-mono text-3xs leading-4", COUNT_TONES[tone])}>{children}</span>
}

export { Tabs, TabsList, OverflowTabsList, TabsTrigger, TabsContent, TabCount }
