import { useCallback, useMemo, useState } from "react"
import { Pencil, RotateCcw, X } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { useChordCapture } from "../hooks/useChordCapture"
import { chordLabel, modifiersPrefix } from "../lib/chords"
import { isApplePlatform, isDesktopApp } from "../lib/platform"
import { updatePreferences, usePreferences } from "../lib/preferences"
import { MOVING_KEYS, SHORTCUT_GROUPS, checkChord, shortcutRows, withChord, withoutChord } from "../lib/shortcuts"
import { SHORTCUT_TEXT } from "../lib/shortcutText"

const CAPTURE_PLACEHOLDER = "…"
const { moving: MOVING_TEXT } = SHORTCUT_TEXT

function GroupHeading({ children }) {
  return <h3 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
}

function MovingKeys({ isApple }) {
  return (
    <section aria-label={MOVING_TEXT.title}>
      <GroupHeading>{MOVING_TEXT.title}</GroupHeading>
      <ul className="divide-y divide-border">
        {MOVING_KEYS.map(({ id, chords }) => (
          <li key={id} className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 py-1 text-xs">
            <span className="min-w-0 flex-1 basis-40">{MOVING_TEXT.labels[id]}</span>
            <span className="flex shrink-0 flex-wrap items-center gap-1">
              {chords.length === 0 && <kbd>{MOVING_TEXT.typing}</kbd>}
              {chords.map((chord) => {
                const label = chordLabel(chord, isApple)
                return <kbd key={label}>{label}</kbd>
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ConflictNotice({ chordLabel, owner, onReplace, onCancel }) {
  return (
    <div role="alert" className="mb-1 flex flex-wrap items-center gap-2 text-xs text-warning">
      <p className="min-w-0 flex-1 basis-48">{SHORTCUT_TEXT.conflict(chordLabel, owner)}</p>
      <Button size="sm" onClick={onReplace}>{SHORTCUT_TEXT.replace}</Button>
      <Button size="sm" variant="outline" onClick={onCancel}>{SHORTCUT_TEXT.cancel}</Button>
    </div>
  )
}

function KeysDisplay({ keys, isCapturing, liveKeys }) {
  if (isCapturing) return <kbd className="text-foreground">{liveKeys}</kbd>
  if (keys) return <kbd>{keys}</kbd>
  return <span className="text-2xs text-muted-foreground">{SHORTCUT_TEXT.unassigned}</span>
}

function ShortcutRow({ row, isCapturing, liveKeys, error, conflict, actions }) {
  return (
    <li className="py-1">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="min-w-0 flex-1 basis-40">
          {row.label}
          {row.isCustom && <Badge className="ml-2 align-middle">{SHORTCUT_TEXT.customised}</Badge>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <KeysDisplay keys={row.keys} isCapturing={isCapturing} liveKeys={liveKeys} />
          <IconButton label={SHORTCUT_TEXT.changeFor(row.label)} icon={Pencil} size="icon-xs" onClick={actions.start} />
          {row.binding && <IconButton label={SHORTCUT_TEXT.clearFor(row.label)} icon={X} size="icon-xs" onClick={actions.clear} />}
          {row.isCustom && <IconButton label={SHORTCUT_TEXT.resetFor(row.label)} icon={RotateCcw} size="icon-xs" onClick={actions.reset} />}
        </span>
      </div>
      {isCapturing && (
        <p aria-live="polite" className="mb-1 text-2xs text-muted-foreground">
          {SHORTCUT_TEXT.capturing}. {SHORTCUT_TEXT.captureHint}
        </p>
      )}
      {error && <p role="alert" className="mb-1 text-2xs text-destructive">{SHORTCUT_TEXT.errors[error]}</p>}
      {conflict && <ConflictNotice {...conflict} onReplace={actions.replace} onCancel={actions.cancel} />}
    </li>
  )
}

export function ShortcutsDialog({ onClose }) {
  const { shortcuts } = usePreferences()
  const [session, setSession] = useState(null)
  const isDesktop = isDesktopApp()
  const isApple = isApplePlatform()
  const rows = useMemo(() => shortcutRows(shortcuts, isDesktop, isApple), [shortcuts, isDesktop, isApple])
  const context = useMemo(() => ({ isDesktop, isApple, overrides: shortcuts }), [isDesktop, isApple, shortcuts])

  const save = useCallback((overrides) => {
    updatePreferences({ shortcuts: overrides })
    setSession(null)
  }, [])

  const handleResult = useCallback(({ chord, error }) => {
    const checked = chord ? checkChord(session.id, chord, context) : { error }
    if (checked.error) setSession((current) => ({ ...current, error: checked.error }))
    else if (checked.conflict) setSession({ id: session.id, chord, conflict: checked.conflict })
    else save(withChord(shortcuts, session.id, chord))
  }, [session, context, shortcuts, save])

  const cancel = useCallback(() => setSession(null), [])
  const isCapturing = Boolean(session) && !session.conflict
  const modifiers = useChordCapture(isCapturing, isApple, { onResult: handleResult, onCancel: cancel })
  const liveKeys = modifiersPrefix(modifiers, isApple) + CAPTURE_PLACEHOLDER

  const actionsFor = (row) => ({
    start: () => setSession({ id: row.id }),
    clear: () => save(withChord(shortcuts, row.id, null)),
    reset: () => save(withoutChord(shortcuts, row.id)),
    cancel,
    replace: () => save(withChord(withChord(shortcuts, session.conflict.id, null), session.id, session.chord)),
  })

  const conflictFor = (row) => {
    if (session?.id !== row.id || !session.conflict) return null
    return { chordLabel: chordLabel(session.chord, isApple), owner: session.conflict.label }
  }

  return (
    <Dialog label={SHORTCUT_TEXT.title} className="max-w-xl" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{SHORTCUT_TEXT.title}</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group} aria-label={SHORTCUT_TEXT.groups[group]}>
            <GroupHeading>{SHORTCUT_TEXT.groups[group]}</GroupHeading>
            <ul className="divide-y divide-border">
              {rows.filter((row) => row.group === group).map((row) => (
                <ShortcutRow
                  key={row.id}
                  row={row}
                  isCapturing={isCapturing && session.id === row.id}
                  liveKeys={liveKeys}
                  error={session?.id === row.id ? session.error : null}
                  conflict={conflictFor(row)}
                  actions={actionsFor(row)}
                />
              ))}
            </ul>
          </section>
        ))}
        <MovingKeys isApple={isApple} />
        {!isDesktop && <p className="text-2xs text-muted-foreground">{SHORTCUT_TEXT.webNotice}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" disabled={Object.keys(shortcuts).length === 0} onClick={() => save({})}>{SHORTCUT_TEXT.resetAll}</Button>
      </DialogFooter>
    </Dialog>
  )
}
