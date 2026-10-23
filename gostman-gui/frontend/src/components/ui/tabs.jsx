import * as React from "react"
import { ORIENTATION, moveFocus } from "../../lib/rovingFocus"
import { scrollIntoStrip } from "../../lib/scrollIntoStrip"
import { cn } from "../../lib/utils"

export const TAB_KEYS = { selector: "[role=tab]", orientation: ORIENTATION.horizontal, activate: true }

const TabsContext = React.createContext({ value: "", setValue: () => {} })

function Tabs({ value, onValueChange, children, className }) {
  const context = React.useMemo(() => ({ value, setValue: onValueChange }), [value, onValueChange])
  return (
    <TabsContext.Provider value={context}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, label, children }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={(event) => moveFocus(event, TAB_KEYS)}
      className={cn("flex h-full min-w-0 items-stretch gap-4 overflow-x-auto scrollbar-none", className)}
    >
      {children}
    </div>
  )
}

function TabsTrigger({ className, value, children }) {
  const { value: currentValue, setValue } = React.useContext(TabsContext)
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
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setValue(value)}
      className={cn(
        "inline-flex min-w-6 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pt-0.5 text-xs font-medium",
        isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}

function TabsContent({ className, value, children }) {
  const { value: currentValue } = React.useContext(TabsContext)
  if (currentValue !== value) return null
  return <div role="tabpanel" className={className}>{children}</div>
}

const COUNT_TONES = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
}

function TabCount({ tone = "neutral", children }) {
  return <span className={cn("rounded px-1 font-mono text-3xs leading-4", COUNT_TONES[tone])}>{children}</span>
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabCount }
