import * as React from "react"
import { cn } from "../../lib/utils"

const TabsContext = React.createContext({
  value: "",
  setValue: () => {},
})

const Tabs = ({ defaultValue, value, onValueChange, children, className }) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")

  const currentValue = value !== undefined ? value : internalValue
  const setValue = onValueChange || setInternalValue

  return (
    <TabsContext.Provider value={{ value: currentValue, setValue }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

const TabsList = React.forwardRef(({ className, children }, ref) => {
  const { value } = React.useContext(TabsContext)

  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted/50 p-1 text-muted-foreground border border-border/50",
        className
      )}
    >
      {children}
    </div>
  )
})
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef(({ className, value, children, icon: Icon }, ref) => {
  const { value: currentValue, setValue } = React.useContext(TabsContext)
  const isActive = currentValue === value

  return (
    <button
      ref={ref}
      onClick={() => setValue(value)}
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef(({ className, value, children, noMargin }, ref) => {
  const { value: currentValue } = React.useContext(TabsContext)

  if (currentValue !== value) return null

  return (
    <div
      ref={ref}
      className={cn(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        !noMargin && "mt-2",
        className
      )}
    >
      {children}
    </div>
  )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
