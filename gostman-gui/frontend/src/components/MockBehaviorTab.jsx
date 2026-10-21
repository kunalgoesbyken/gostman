import { Checkbox } from "./ui/checkbox"
import { SectionLabel } from "./ui/panel"
import { MockBehaviorFields } from "./MockBehaviorFields"
import { MOCK_TEXT } from "../lib/mockText"

export function MockBehaviorTab({ settings, actions }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <SectionLabel>{MOCK_TEXT.behaviorTitle}</SectionLabel>
      <MockBehaviorFields value={settings.behavior} onChange={actions.setBehavior} />
      <p className="text-xs text-muted-foreground">{MOCK_TEXT.behaviorHint}</p>
      <Checkbox className="justify-start" checked={settings.cors} onChange={(event) => actions.setSettings({ cors: event.target.checked })}>
        {MOCK_TEXT.cors}
      </Checkbox>
      <p className="text-xs text-muted-foreground">{MOCK_TEXT.corsHint}</p>
    </div>
  )
}
