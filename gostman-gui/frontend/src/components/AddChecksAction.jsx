import { Suspense, lazy, useState } from "react"
import { ListPlus } from "lucide-react"
import { Button } from "./ui/button"
import { RESPONSE_CHECKS_TEXT } from "../lib/checksText"
import { canProposeChecks } from "../lib/responseChecks"
import { selectActiveTab, useAppStore } from "../store/appStore"

const AddChecksDialog = lazy(() => import("./AddChecksDialog").then((module) => ({ default: module.AddChecksDialog })))

export function AddChecksAction() {
  const response = useAppStore((s) => selectActiveTab(s)?.response)
  const [isOpen, setIsOpen] = useState(false)
  if (!canProposeChecks(response)) return null

  return (
    <>
      <Button variant="outline" size="sm" title={RESPONSE_CHECKS_TEXT.button} onClick={() => setIsOpen(true)}>
        <ListPlus />
        <span className="max-sm:sr-only">{RESPONSE_CHECKS_TEXT.button}</span>
      </Button>
      {isOpen && (
        <Suspense fallback={null}>
          <AddChecksDialog response={response} onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
