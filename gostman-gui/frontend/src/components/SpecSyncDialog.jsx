import { useState } from "react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { MethodTag } from "./MethodTag"
import { sourceLabel } from "../lib/openapiSpec"
import { defaultSelection, isEmptyPlan } from "../lib/specSync"
import { SPEC_TEXT } from "../lib/specText"

function Change({ id, label, method, detail, edited, checked, onToggle }) {
  return (
    <li className="flex min-h-7 items-center gap-2">
      <Checkbox label={label} checked={checked} onChange={() => onToggle(id)} />
      <MethodTag method={method} className="w-12" />
      <span className="min-w-0 flex-1 truncate text-xs" title={label}>{detail}</span>
      {edited && <span className="shrink-0 text-2xs text-warning">{SPEC_TEXT.locallyEdited}</span>}
    </li>
  )
}

function Group({ title, count, children }) {
  if (count === 0) return null
  return (
    <section className="pb-4">
      <h3 className="pb-1 text-xs font-semibold text-foreground">{title} ({count})</h3>
      <ul>{children}</ul>
    </section>
  )
}

function Summary({ link, plan }) {
  return (
    <p className="pb-3 text-xs text-muted-foreground">
      {sourceLabel(link.source)} - {SPEC_TEXT.syncedAt} {new Date(link.syncedAt).toLocaleString()}
      {plan.unchanged > 0 && ` - ${SPEC_TEXT.unchanged(plan.unchanged)}`}
    </p>
  )
}

export function SpecSyncDialog({ dialog, link, actions, onClose }) {
  const { plan, folderId } = dialog
  const [selected, setSelected] = useState(() => defaultSelection(plan))
  const hasEdits = [...plan.changed, ...plan.removed].some((item) => item.edited)

  const toggle = (key) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  return (
    <Dialog label={SPEC_TEXT.syncTitle} size="lg" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{SPEC_TEXT.syncTitle}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <Summary link={link} plan={plan} />
        {isEmptyPlan(plan) && <p className="text-xs text-muted-foreground">{SPEC_TEXT.upToDate}</p>}
        <Group title={SPEC_TEXT.added} count={plan.added.length}>
          {plan.added.map((operation) => (
            <Change
              key={operation.key}
              id={operation.key}
              label={operation.key}
              method={operation.method}
              detail={`${operation.path}${operation.summary ? ` - ${operation.summary}` : ""}`}
              checked={selected.has(operation.key)}
              onToggle={toggle}
            />
          ))}
        </Group>
        <Group title={SPEC_TEXT.changed} count={plan.changed.length}>
          {plan.changed.map((item) => (
            <Change
              key={item.key}
              id={item.key}
              label={item.key}
              method={item.method}
              detail={item.name}
              edited={item.edited}
              checked={selected.has(item.key)}
              onToggle={toggle}
            />
          ))}
        </Group>
        <Group title={SPEC_TEXT.removed} count={plan.removed.length}>
          {plan.removed.map((item) => (
            <Change
              key={item.key}
              id={item.key}
              label={item.key}
              method={item.method}
              detail={item.name}
              edited={item.edited}
              checked={selected.has(item.key)}
              onToggle={toggle}
            />
          ))}
        </Group>
        {hasEdits && <p className="text-xs text-muted-foreground">{SPEC_TEXT.keepEditsNote}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{SPEC_TEXT.close}</Button>
        <Button disabled={selected.size === 0} onClick={() => actions.apply(folderId, plan, selected)}>{SPEC_TEXT.apply}</Button>
      </DialogFooter>
    </Dialog>
  )
}
