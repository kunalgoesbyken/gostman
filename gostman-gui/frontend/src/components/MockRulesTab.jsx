import { useRef } from "react"
import { Download, Plus, Upload } from "lucide-react"
import { Button } from "./ui/button"
import { Notice } from "./ui/panel"
import { MockRuleEditor } from "./MockRuleEditor"
import { MOCK_TEXT } from "../lib/mockText"

export function MockRulesTab({ rules, actions }) {
  const fileInput = useRef(null)
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{MOCK_TEXT.rulesHint}</p>
        <input ref={fileInput} type="file" accept=".yaml,.yml,.json" className="hidden" onChange={(event) => {
          const [file] = event.target.files
          event.target.value = ""
          if (file) actions.importRules(file)
        }} />
        <Button variant="outline" size="sm" onClick={() => fileInput.current.click()}>
          <Upload />
          {MOCK_TEXT.importRules}
        </Button>
        <Button variant="outline" size="sm" disabled={rules.length === 0} onClick={actions.exportRules}>
          <Download />
          {MOCK_TEXT.exportRules}
        </Button>
        <Button variant="outline" size="sm" onClick={actions.addRule}>
          <Plus />
          {MOCK_TEXT.addRule}
        </Button>
      </div>
      {rules.length === 0 ? (
        <Notice>{MOCK_TEXT.noRules}</Notice>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto" aria-label={MOCK_TEXT.tabs.rules}>
          {rules.map((rule, index) => (
            <MockRuleEditor key={rule.id} rule={rule} position={index + 1} isLast={index === rules.length - 1} actions={actions} />
          ))}
        </ul>
      )}
    </>
  )
}
