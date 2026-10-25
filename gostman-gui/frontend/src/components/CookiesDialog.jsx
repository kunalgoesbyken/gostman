import { useMemo, useState } from "react"
import { Cookie, Search, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { SectionLabel } from "./ui/panel"
import { TabCount } from "./ui/tabs"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"
import { COOKIES_TEXT as TEXT } from "../lib/cookiesText"
import { TREE_TEXT } from "../lib/treeText"

const TABLE_WIDTH = "min-w-[40rem]"
const COLUMNS = "grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_4rem_minmax(0,1fr)_1.75rem] items-center gap-2 px-3"
const CELL = "truncate font-mono text-xs"

const matches = (cookie, needle) => `${cookie.name}\n${cookie.domain}`.toLowerCase().includes(needle)

function CookieRow({ cookie, onRemove }) {
  const expiry = cookie.expires || TEXT.session
  return (
    <div className={`${COLUMNS} h-8 border-b border-border`}>
      <span title={cookie.name} className={`${CELL} text-foreground`}>{cookie.name}</span>
      <span title={cookie.value} className={`${CELL} text-muted-foreground`}>{cookie.value}</span>
      <span title={cookie.domain} className={`${CELL} text-muted-foreground`}>{cookie.domain}</span>
      <span title={cookie.path} className={`${CELL} text-muted-foreground`}>{cookie.path || "/"}</span>
      <span title={expiry} className={`${CELL} text-muted-foreground`}>{expiry}</span>
      <IconButton label={TEXT.remove(cookie.name)} icon={X} onClick={onRemove} />
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
    <Dialog label={TEXT.title} size="lg" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{TEXT.title}</DialogTitle>
        <TabCount>{cookies.length}</TabCount>
        <Button variant="outline" size="sm" className="ml-auto" disabled={cookies.length === 0} onClick={clearCookies}>
          {TEXT.clearAll}
        </Button>
      </DialogHeader>
      <SearchField value={query} onChange={setQuery} placeholder={TEXT.filter} />
      {shown.length === 0 ? (
        <div className="min-h-0 flex-1">
          {cookies.length === 0
            ? <EmptyState icon={Cookie} title={TEXT.emptyTitle} description={TEXT.emptyHint} />
            : <EmptyState icon={Search} title={TREE_TEXT.noResultsTitle} description={TEXT.noMatches} />}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
          <div className={`${COLUMNS} ${TABLE_WIDTH} h-8 shrink-0 border-b border-border`}>
            <SectionLabel className="truncate">{TEXT.columns.name}</SectionLabel>
            <SectionLabel className="truncate">{TEXT.columns.value}</SectionLabel>
            <SectionLabel className="truncate">{TEXT.columns.domain}</SectionLabel>
            <SectionLabel className="truncate">{TEXT.columns.path}</SectionLabel>
            <SectionLabel className="truncate">{TEXT.columns.expires}</SectionLabel>
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
