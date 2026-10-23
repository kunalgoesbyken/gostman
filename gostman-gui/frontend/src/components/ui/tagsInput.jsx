import { useId, useState } from "react"
import { X } from "lucide-react"
import { CONTROL_BASE } from "./input"
import { normalizeTags, splitTags } from "../../lib/tags"
import { cn } from "../../lib/utils"

const PICKED_SUGGESTION = "insertReplacementText"
const SEPARATOR = ","

function TagChip({ tag, disabled, onRemove }) {
  return (
    <span className="inline-flex max-w-full items-center gap-0.5 rounded bg-muted py-0.5 pl-1.5 pr-0.5 text-2xs text-foreground">
      <span className="truncate">{tag}</span>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Remove tag ${tag}`}
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

export function TagsInput({ value, onChange, label, placeholder, suggestions = [], disabled = false, className }) {
  const [draft, setDraft] = useState("")
  const listId = useId()
  const tags = normalizeTags(value)
  const offered = suggestions.filter((tag) => !tags.includes(tag))

  function commit(text) {
    setDraft("")
    const added = splitTags(text)
    if (added.length > 0) onChange(normalizeTags([...tags, ...added]))
  }

  const remove = (tag) => onChange(tags.filter((kept) => kept !== tag))

  function handleChange(event) {
    const text = event.target.value
    if (text.includes(SEPARATOR) || event.nativeEvent.inputType === PICKED_SUGGESTION) commit(text)
    else setDraft(text)
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault()
      commit(draft)
      return
    }
    if (event.key === "Backspace" && draft === "" && tags.length > 0) remove(tags[tags.length - 1])
  }

  return (
    <div
      className={cn(
        CONTROL_BASE,
        "flex h-auto min-h-7 flex-wrap items-center gap-1 py-0.5 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ring",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {tags.map((tag) => <TagChip key={tag} tag={tag} disabled={disabled} onRemove={() => remove(tag)} />)}
      <input
        value={draft}
        disabled={disabled}
        aria-label={label}
        list={offered.length > 0 ? listId : undefined}
        placeholder={tags.length === 0 ? placeholder : ""}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        className="h-5 min-w-[6rem] flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed"
      />
      {offered.length > 0 && (
        <datalist id={listId}>
          {offered.map((tag) => <option key={tag} value={tag} />)}
        </datalist>
      )}
    </div>
  )
}
