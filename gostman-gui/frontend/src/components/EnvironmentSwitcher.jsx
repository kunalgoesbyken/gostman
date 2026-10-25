import { useEffect, useRef, useState } from "react"
import { Settings2 } from "lucide-react"
import { IconButton } from "./ui/button"
import { Select } from "./ui/select"
import { ColorDot } from "./ui/colorPicker"
import { ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { cn } from "../lib/utils"
import { useEnvironmentChoice } from "../hooks/useEnvironmentChoice"
import { useAppStore } from "../store/appStore"

const FOLLOW_HIGHLIGHT_MS = 1600

function useFollowed(collectionId, activeId) {
  const previous = useRef({ collectionId, activeId })
  const [followed, setFollowed] = useState(false)
  useEffect(() => {
    const before = previous.current
    previous.current = { collectionId, activeId }
    if (!before.activeId || before.activeId === activeId || before.collectionId === collectionId) return undefined
    setFollowed(true)
    const timer = setTimeout(() => setFollowed(false), FOLLOW_HIGHLIGHT_MS)
    return () => {
      clearTimeout(timer)
      setFollowed(false)
    }
  }, [collectionId, activeId])
  return followed
}

const options = (environments) => environments.map((environment) => (
  <option key={environment.id} value={environment.id}>{environment.name}</option>
))

export function EnvironmentSwitcher() {
  const { collectionId, collectionName, own, shared, active } = useEnvironmentChoice()
  const setActiveEnvironment = useAppStore((s) => s.setActiveEnvironment)
  const openEnvironmentDialog = useAppStore((s) => s.openEnvironmentDialog)
  const followed = useFollowed(collectionId, active?.id)
  const label = active && collectionName ? TEXT.inCollection(active.name, collectionName) : active?.name || TEXT.noEnvironment

  return (
    <div className="flex min-w-0 items-center gap-1">
      {active && <ColorDot color={active.color} />}
      <Select
        value={active?.id || ""}
        onChange={(event) => setActiveEnvironment(event.target.value)}
        disabled={!active}
        aria-label={TEXT.active}
        title={label}
        controlSize="md"
        className={cn("w-auto max-w-32 transition-colors duration-500 sm:w-28 sm:max-w-none md:w-44", followed && "border-primary")}
      >
        {!active && <option value="">{TEXT.noEnvironment}</option>}
        {own.length === 0 ? options(shared) : (
          <>
            <optgroup label={collectionName}>{options(own)}</optgroup>
            {shared.length > 0 && <optgroup label={TEXT.shared}>{options(shared)}</optgroup>}
          </>
        )}
      </Select>
      <span className="sr-only" aria-live="polite">{followed && active ? TEXT.followed(active.name, collectionName) : ""}</span>
      <IconButton label={TEXT.title} icon={Settings2} size="icon" onClick={openEnvironmentDialog} />
    </div>
  )
}
