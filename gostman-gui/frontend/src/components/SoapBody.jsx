import { AlertTriangle } from "lucide-react"
import { Notice } from "./ui/panel"
import { SOAP_TEXT } from "../lib/soapText"

const faultFields = () => [
  ['code', SOAP_TEXT.faultCode],
  ['reason', SOAP_TEXT.faultReason],
  ['actor', SOAP_TEXT.faultActor],
]

function FaultSummary({ fault }) {
  const fields = faultFields().filter(([key]) => fault[key])
  return (
    <section aria-label={SOAP_TEXT.fault} className="border-b border-border">
      <Notice tone="destructive" icon={AlertTriangle} edge="">{SOAP_TEXT.fault}</Notice>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 px-3 pb-2 text-xs">
        {fields.map(([key, label]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono text-foreground">{fault[key]}</dd>
          </div>
        ))}
        {fault.detail && (
          <div className="contents">
            <dt className="text-muted-foreground">{SOAP_TEXT.faultDetail}</dt>
            <dd><pre dir="ltr" className="whitespace-pre-wrap font-mono text-foreground">{fault.detail}</pre></dd>
          </div>
        )}
      </dl>
    </section>
  )
}

export function SoapBody({ soap }) {
  return (
    <>
      {soap.fault && <FaultSummary fault={soap.fault} />}
      <pre dir="ltr" className="whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-foreground">{soap.formatted}</pre>
    </>
  )
}
