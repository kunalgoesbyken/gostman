import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Notice, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import {
  SOAP_TEXT, SOAP_VERSIONS, detectSoapVersion, formatXml, readSoapAction, switchSoapVersion, writeSoapAction,
} from "../lib/soap"

export function SoapBar({ request, onUpdateRequest }) {
  const [problem, setProblem] = useState("")

  const format = () => {
    const formatted = formatXml(request.body)
    setProblem(formatted.error ? SOAP_TEXT.malformed(formatted.error) : "")
    if (formatted.text !== undefined) onUpdateRequest({ body: formatted.text })
  }

  return (
    <>
      <Toolbar>
        <SegmentedControl
          label={SOAP_TEXT.versionLabel}
          options={SOAP_VERSIONS}
          value={detectSoapVersion(request.body)}
          onChange={(version) => onUpdateRequest({ body: switchSoapVersion(request.body, version) })}
        />
        <Input
          value={readSoapAction(request.headers)}
          onChange={(event) => onUpdateRequest({ headers: writeSoapAction(request.headers, event.target.value) })}
          placeholder={SOAP_TEXT.actionPlaceholder}
          aria-label={SOAP_TEXT.actionLabel}
          spellCheck={false}
          className="max-w-72 font-mono"
        />
        <Button variant="ghost" size="sm" title={SOAP_TEXT.formatTitle} disabled={request.body.trim() === ""} onClick={format} className="ml-auto">
          {SOAP_TEXT.format}
        </Button>
      </Toolbar>
      {problem && <Notice tone="destructive">{problem}</Notice>}
    </>
  )
}
