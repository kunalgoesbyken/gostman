import { useMemo, useState } from "react"
import { Cookie, Search, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { SectionLabel } from "./ui/panel"
import { TabCount } from "./ui/tabs"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"

const TABLE_WIDTH = "min-w-[40rem]"
const COLUMNS = "grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_4rem_minmax(0,1fr)_1.75rem] items-center gap-2 px-3"
const CELL = "truncate font-mono text-xs"
const EMPTY_HINT = "Cookies set by responses are kept here and sent back to the same site on later requests."

const matches = (cookie, needle) => `${cookie.name}\n${cookie.domain}`.toLowerCase().includes(needle)

function CookieRow({ cookie, onRemove }) {
  const expiry = cookie.expires || "Session"
  return (
    <div className={`${COLUMNS} h-8 border-b border-border`}>
      <span title={cookie.name} className={`${CELL} text-foreground`}>{cookie.name}</span>
      <span title={cookie.value} className={`${CELL} text-muted-foreground`}>{cookie.value}</span>
      <span title={cookie.domain} className={`${CELL} text-muted-foreground`}>{cookie.domain}</span>
      <span title={cookie.path} className={`${CELL} text-muted-foreground`}>{cookie.path || "/"}</span>
      <span title={expiry} className={`${CELL} text-muted-foreground`}>{expiry}</span>
      <IconButton label={`Delete cookie ${cookie.name}`} icon={X} onClick={onRemove} />
    </div>
  )
}

export function CookiesDialog({ onClose }) {
  const cookies = useAppStore((s) => s.cookies)
  const removeCookie = useAppStore((s) => s.removeCookie)
  const clearCookies = useAppStore((s) => s.clearCookies)
  const [query, setQuery] = useState("")

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? cookies.filter((cookie) => matches(cookie, needle)) : cookies
  }, [cookies, query])

  return (
    <Dialog label="Cookies" size="lg" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>Cookies</DialogTitle>
        <TabCount>{cookies.length}</TabCount>
        <Button variant="outline" size="sm" className="ml-auto" disabled={cookies.length === 0} onClick={clearCookies}>
          Clear all
        </Button>
      </DialogHeader>
      <SearchField value={query} onChange={setQuery} placeholder="Filter by name or domain" />
      {shown.length === 0 ? (
        <div className="min-h-0 flex-1">
          {cookies.length === 0
            ? <EmptyState icon={Cookie} title="No cookies stored" description={EMPTY_HINT} />
            : <EmptyState icon={Search} title="No results" description="No cookie name or domain matches." />}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
          <div className={`${COLUMNS} ${TABLE_WIDTH} h-8 shrink-0 border-b border-border`}>
            <SectionLabel className="truncate">Name</SectionLabel>
            <SectionLabel className="truncate">Value</SectionLabel>
            <SectionLabel className="truncate">Domain</SectionLabel>
            <SectionLabel className="truncate">Path</SectionLabel>
            <SectionLabel className="truncate">Expires</SectionLabel>
            <span />
          </div>
          <div className={`${TABLE_WIDTH} min-h-0 flex-1 overflow-y-auto`}>
            {shown.map((cookie) => (
              <CookieRow
                key={`${cookie.domain}\n${cookie.path}\n${cookie.name}`}
                cookie={cookie}
                onRemove={() => removeCookie(cookie)}
              />
            ))}
          </div>
        </div>
      )}
    </Dialog>
  )
}
