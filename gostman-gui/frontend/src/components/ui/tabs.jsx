import * as React from "react"
import { cn } from "../../lib/utils"

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
    if (isActive) triggerRef.current.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [isActive])

  return (
    <button
      ref={triggerRef}
      type="button"
      role="tab"
      aria-selected={isActive}
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

function TabCount({ children }) {
  return <span className="rounded bg-muted px-1 font-mono text-[10px] leading-4 text-muted-foreground">{children}</span>
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabCount }
