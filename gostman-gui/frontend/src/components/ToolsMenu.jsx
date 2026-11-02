import { useRef, useState } from "react"
import { Wrench } from "lucide-react"
import { Button } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { useFeatureAccess } from "../lib/featureAccess"
import { FEATURES_TEXT } from "../lib/featuresText"
import { toolMenuItems } from "../lib/toolsMenu"

export function ToolsMenu({ style }) {
  const [anchor, setAnchor] = useState(null)
  const buttonRef = useRef(null)
  const open = useFeatureAccess((state) => state.open)
  const toggle = () => {
    const rect = buttonRef.current.getBoundingClientRect()
    setAnchor(anchor ? null : { x: rect.left, y: rect.bottom })
  }
  return (
    <>
      <Button ref={buttonRef} variant="ghost" aria-haspopup="menu" aria-expanded={Boolean(anchor)} title={FEATURES_TEXT.toolsMenuHint} onClick={toggle} style={style}>
        <Wrench />
        <span className="max-sm:sr-only">{FEATURES_TEXT.toolsMenu}</span>
      </Button>
      {anchor && <ContextMenu position={anchor} title={FEATURES_TEXT.toolsMenu} items={toolMenuItems(open)} onClose={() => setAnchor(null)} />}
    </>
  )
}
