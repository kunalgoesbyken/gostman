import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"

export const DEFAULT_DOCS_OPTIONS = { title: "", includeExamples: true, playground: false }

export function DocsOptions({ options, onChange }) {
  const update = (patch) => onChange({ ...options, ...patch })

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      <Input
        value={options.title}
        onChange={(event) => update({ title: event.target.value })}
        placeholder="Title (default: API documentation)"
        aria-label="Documentation title"
        className="min-w-48 flex-1"
      />
      <Checkbox checked={options.includeExamples} onChange={(event) => update({ includeExamples: event.target.checked })}>
        Include example responses
      </Checkbox>
      <Checkbox checked={options.playground} onChange={(event) => update({ playground: event.target.checked })}>
        Include a Try it panel
      </Checkbox>
    </div>
  )
}
