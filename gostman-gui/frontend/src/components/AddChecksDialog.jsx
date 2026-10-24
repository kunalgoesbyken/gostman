import { useMemo, useState } from "react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { useAppStore } from "../store/appStore"
import { RESPONSE_CHECKS_TEXT } from "../lib/checksText"
import { schemaText } from "../lib/jsonSchema"
import { activeAssertions, addChecks, newProposals, proposeChecks } from "../lib/responseChecks"
import { SCHEMA_OPERATOR, titleOf } from "../lib/scripting/assertions"

const PRETTY_INDENT = 2

function Proposal({ proposal, checked, onToggle }) {
  const { assertion } = proposal
  const label = titleOf(assertion)
  return (
    <li className="flex items-start gap-2 py-1.5">
      <Checkbox label={label} checked={checked} onChange={() => onToggle(proposal.id)} className="h-4" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{proposal.description}</p>
        {assertion.operator === SCHEMA_OPERATOR && (
          <pre className="mt-1 max-h-48 overflow-auto rounded border border-border bg-muted/40 p-2 font-mono text-2xs text-foreground">
            {schemaText(assertion.value, PRETTY_INDENT)}
          </pre>
        )}
      </div>
    </li>
  )
}

export function AddChecksDialog({ response, onClose }) {
  const assertions = useAppStore(activeAssertions)
  const proposals = useMemo(() => newProposals(proposeChecks(response), assertions), [response, assertions])
  const [selected, setSelected] = useState(() => new Set(proposals.filter((proposal) => proposal.isSuggested).map((proposal) => proposal.id)))
  const chosen = proposals.filter((proposal) => selected.has(proposal.id))

  const toggle = (id) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const add = () => {
    addChecks(chosen.map((proposal) => proposal.assertion))
    onClose()
  }

  return (
    <Dialog label={RESPONSE_CHECKS_TEXT.title} size="lg" className="h-auto sm:max-h-[36rem]" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{RESPONSE_CHECKS_TEXT.title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="pb-3 text-xs text-muted-foreground">{proposals.length > 0 ? RESPONSE_CHECKS_TEXT.intro : RESPONSE_CHECKS_TEXT.nothingNew}</p>
        <ul>
          {proposals.map((proposal) => (
            <Proposal key={proposal.id} proposal={proposal} checked={selected.has(proposal.id)} onToggle={toggle} />
          ))}
        </ul>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{RESPONSE_CHECKS_TEXT.cancel}</Button>
        <Button disabled={chosen.length === 0} onClick={add}>{RESPONSE_CHECKS_TEXT.add(chosen.length)}</Button>
      </DialogFooter>
    </Dialog>
  )
}
