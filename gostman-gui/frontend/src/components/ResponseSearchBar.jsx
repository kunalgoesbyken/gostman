import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react'
import { IconButton } from './ui/button'
import { Input } from './ui/input'
import { Toolbar } from './ui/panel'
import { RESPONSE_TEXT as TEXT } from '../lib/responseText'

function statusText(query, index, count, capped) {
  if (query === '') return ''
  if (count === 0) return TEXT.noMatches
  return TEXT.matchPosition(index, count, capped)
}

export function SearchBar({ query, onQueryChange, index, count, capped, onStep, onClose }) {
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      onStep(event.shiftKey ? -1 : 1)
    }
  }

  return (
    <Toolbar className="relative gap-1">
      <Search className="pointer-events-none absolute left-5 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={TEXT.findInBody}
        aria-label={TEXT.findInBody}
        spellCheck={false}
        className="pl-7"
      />
      <span aria-live="polite" className="min-w-16 shrink-0 whitespace-nowrap px-1 text-center font-mono text-2xs text-muted-foreground">
        {statusText(query, index, count, capped)}
      </span>
      <IconButton label={TEXT.previousMatch} icon={ChevronUp} onClick={() => onStep(-1)} disabled={count === 0} />
      <IconButton label={TEXT.nextMatch} icon={ChevronDown} onClick={() => onStep(1)} disabled={count === 0} />
      <IconButton label={TEXT.closeSearch} icon={X} onClick={onClose} />
    </Toolbar>
  )
}

export function FilterBar({ path, onPathChange, error }) {
  return (
    <div className="shrink-0 border-b border-border">
      <Toolbar className="relative gap-1 border-b-0">
        <Filter className="pointer-events-none absolute left-5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={path}
          onChange={(event) => onPathChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && onPathChange('')}
          placeholder={TEXT.filterPlaceholder}
          aria-label={TEXT.filterLabel}
          aria-invalid={Boolean(error)}
          spellCheck={false}
          className={`pl-7 font-mono ${error ? 'border-destructive' : ''}`}
        />
        {path !== '' && <IconButton label={TEXT.clearFilter} icon={X} onClick={() => onPathChange('')} />}
      </Toolbar>
      {error && <p role="alert" className="px-3 pb-2 text-xs text-destructive [overflow-wrap:anywhere]">{error}</p>}
    </div>
  )
}
