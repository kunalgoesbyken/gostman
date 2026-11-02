import { Badge } from './ui/badge'
import { SectionLabel } from './ui/panel'
import { certificateFacts, certificateStanding } from '../lib/certificates'
import { TIMELINE_TEXT } from '../lib/timelineText'

function CertificateCard({ certificate, number, total }) {
  const standing = certificateStanding(certificate)
  return (
    <div className="rounded-md border border-border p-2">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
        <span>{TIMELINE_TEXT.certificates.position({ number, total })}</span>
        {certificate.ca && <Badge variant="outline">{TIMELINE_TEXT.certificates.authority}</Badge>}
        {standing && <Badge variant="serverError">{standing}</Badge>}
      </div>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-2xs">
        {certificateFacts(certificate).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd dir="auto" className="break-all font-mono text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function CertificateChain({ chain }) {
  if (!chain?.length) return null
  return (
    <section className="min-w-0">
      <SectionLabel>{TIMELINE_TEXT.certificates.title}</SectionLabel>
      <div className="flex flex-col gap-2">
        {chain.map((certificate, index) => (
          <CertificateCard key={certificate.fingerprint} certificate={certificate} number={index + 1} total={chain.length} />
        ))}
      </div>
    </section>
  )
}
