import { TIMELINE_TEXT } from './timelineText'

const SOON_DAYS = 30
const MS_PER_DAY = 86400000
const DATE_LENGTH = 10

const day = (iso) => iso.slice(0, DATE_LENGTH)

export function certificateStanding(certificate, now = Date.now()) {
  const left = Date.parse(certificate.notAfter) - now
  if (Date.parse(certificate.notBefore) > now || left < 0) return TIMELINE_TEXT.certificates.expired
  if (left < SOON_DAYS * MS_PER_DAY) return TIMELINE_TEXT.certificates.expiresSoon
  return ''
}

export function certificateFacts(certificate) {
  const labels = TIMELINE_TEXT.certificates
  return [
    [labels.subject, certificate.subject],
    [labels.issuer, certificate.issuer],
    [labels.validFrom, day(certificate.notBefore)],
    [labels.validTo, day(certificate.notAfter)],
    [labels.names, certificate.names?.length > 0 && certificate.names.join(', ')],
    [labels.serial, certificate.serial],
    [labels.fingerprint, certificate.fingerprint],
    [labels.keyType, certificate.keyType],
    [labels.signature, certificate.signature],
  ].filter(([, value]) => value)
}

export function redirectSteps(hops) {
  return hops.map((hop, index) => ({
    number: index + 1,
    status: hop.status,
    url: hop.url,
    ms: hop.totalMs,
  }))
}
