import { ChevronDown, ChevronUp } from "lucide-react"
import { IconButton } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { PreferenceGroup } from "./PreferenceRows"
import { updatePreferences } from "../../lib/preferences"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { sidebarViewName } from "../../lib/sidebarText"
import { canHideView, withViewMoved, withViewVisible } from "../../lib/sidebarViews"

const saveViews = (sidebarViews) => updatePreferences({ sidebarViews })

function ViewRow({ views, entry, index }) {
  const name = sidebarViewName(entry.id)
  return (
    <li className="flex items-center gap-2">
      <Checkbox
        checked={entry.visible}
        disabled={entry.visible && !canHideView(views, entry.id)}
        onChange={(event) => saveViews(withViewVisible(views, entry.id, event.target.checked))}
        className="h-auto min-h-6 flex-1 justify-start py-0.5 text-start text-xs text-foreground"
      >
        {name}
      </Checkbox>
      <IconButton label={PREFERENCES_TEXT.moveViewUp(name)} icon={ChevronUp} size="icon-xs" disabled={index === 0} onClick={() => saveViews(withViewMoved(views, entry.id, -1))} />
      <IconButton label={PREFERENCES_TEXT.moveViewDown(name)} icon={ChevronDown} size="icon-xs" disabled={index === views.length - 1} onClick={() => saveViews(withViewMoved(views, entry.id, 1))} />
    </li>
  )
}

export function SidebarViewsGroup({ preferences }) {
  const views = preferences.sidebarViews
  return (
    <PreferenceGroup title={PREFERENCES_TEXT.fields.sidebarViews} hint={PREFERENCES_TEXT.sidebarViewsHint}>
      <ul className="max-w-sm space-y-1">
        {views.map((entry, index) => <ViewRow key={entry.id} views={views} entry={entry} index={index} />)}
      </ul>
    </PreferenceGroup>
  )
}
