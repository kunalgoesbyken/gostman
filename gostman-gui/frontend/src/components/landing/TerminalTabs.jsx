import { Tabs, TabsList, TabsTrigger } from "../ui/tabs"

export function TerminalTabs({ label, value, onChange, items }) {
  return (
    <Tabs value={value} onValueChange={onChange} className="h-full min-w-0">
      <TabsList label={label} className="gap-2">
        {items.map((item) => (
          <TabsTrigger key={item.id} value={item.id} className="rounded-md px-1.5">
            {item.content}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
