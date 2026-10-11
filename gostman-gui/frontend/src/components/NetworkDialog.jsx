import { useState } from "react"
import { FolderOpen, MonitorDown, Plus, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { SectionLabel } from "./ui/panel"
import { Select } from "./ui/select"
import { BLANK_CERTIFICATE, PROXY_CUSTOM, PROXY_MODES } from "../lib/network"

const CERTIFICATE_COLUMNS = "grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.25fr)_1.75rem] items-center gap-2"
const WEB_NOTICE = "Requests from the web version go through the hosted relay, which cannot use a proxy or certificates from your machine. The desktop app sends requests directly and has these settings."

const messageOf = (error) => error?.message || String(error)

function PathField({ label, path, onPick, onClear }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button variant="outline" size="sm" onClick={onPick} aria-label={`Choose ${label}`}>
        <FolderOpen />
        Choose
      </Button>
      <span title={path} className={`min-w-0 flex-1 truncate font-mono text-xs ${path ? "text-foreground" : "text-muted-foreground"}`}>
        {path || "No file"}
      </span>
      {onClear && path && <IconButton label={`Clear ${label}`} icon={X} size="icon-xs" onClick={onClear} />}
    </div>
  )
}

function CertificateRow({ certificate, onChange, onRemove, onPick }) {
  const pickInto = (field, title) => async () => {
    const path = await onPick(title)
    if (path) onChange({ ...certificate, [field]: path })
  }

  return (
    <div className={CERTIFICATE_COLUMNS}>
      <Input
        value={certificate.host}
        placeholder="api.example.com"
        aria-label="Host"
        spellCheck={false}
        onChange={(event) => onChange({ ...certificate, host: event.target.value })}
        className="font-mono"
      />
      <PathField label="certificate file" path={certificate.certFile} onPick={pickInto("certFile", "Choose the certificate (PEM)")} />
      <PathField label="key file" path={certificate.keyFile} onPick={pickInto("keyFile", "Choose the private key (PEM)")} />
      <IconButton label="Remove certificate" icon={X} onClick={onRemove} />
    </div>
  )
}

function SettingsForm({ draft, onChange, onPick }) {
  const update = (patch) => onChange({ ...draft, ...patch })
  const setCertificates = (certificates) => update({ certificates })
  const pickCA = async () => {
    const caFile = await onPick("Choose the CA certificate (PEM)")
    if (caFile) update({ caFile })
  }

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Proxy</SectionLabel>
      <Field label="Mode">
        <Select value={draft.proxyMode} onChange={(event) => update({ proxyMode: event.target.value })}>
          {PROXY_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>{mode.label}</option>
          ))}
        </Select>
      </Field>
      {draft.proxyMode === PROXY_CUSTOM && (
        <>
          <Field label="Proxy address">
            <Input
              value={draft.proxyUrl}
              placeholder="http://user:password@proxy.example.com:8080"
              spellCheck={false}
              onChange={(event) => update({ proxyUrl: event.target.value })}
              className="font-mono"
            />
          </Field>
          <Field label="Bypass for hosts">
            <Input
              value={draft.proxyBypass}
              placeholder="localhost, *.internal.example.com"
              spellCheck={false}
              onChange={(event) => update({ proxyBypass: event.target.value })}
              className="font-mono"
            />
          </Field>
        </>
      )}

      <SectionLabel className="pt-3">Certificates</SectionLabel>
      <Field label="CA certificate">
        <PathField label="CA certificate" path={draft.caFile} onPick={pickCA} onClear={() => update({ caFile: "" })} />
      </Field>

      <div className={`${CERTIFICATE_COLUMNS} pt-2`}>
        <SectionLabel className="truncate">Client certificate host</SectionLabel>
        <SectionLabel className="truncate">Certificate</SectionLabel>
        <SectionLabel className="truncate">Private key</SectionLabel>
        <span />
      </div>
      {draft.certificates.map((certificate, index) => (
        <CertificateRow
          key={index}
          certificate={certificate}
          onPick={onPick}
          onChange={(next) => setCertificates(draft.certificates.map((existing, at) => (at === index ? next : existing)))}
          onRemove={() => setCertificates(draft.certificates.filter((_, at) => at !== index))}
        />
      ))}
      <Button variant="outline" size="sm" className="self-start" onClick={() => setCertificates([...draft.certificates, BLANK_CERTIFICATE])}>
        <Plus />
        Add client certificate
      </Button>
      <p className="text-xs text-muted-foreground">
        Certificates and keys are PEM files. A client certificate is presented only to its host; use *.example.com to cover subdomains.
      </p>
    </div>
  )
}

export function NetworkDialog({ settings, actions, onClose }) {
  const [draft, setDraft] = useState(settings)
  const [failure, setFailure] = useState("")

  const edit = (next) => {
    setDraft(next)
    setFailure("")
  }

  const save = async () => {
    try {
      await actions.saveSettings(draft)
      onClose()
    } catch (error) {
      setFailure(messageOf(error))
    }
  }

  return (
    <Dialog label="Network settings" size="lg" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>Network settings</DialogTitle>
      </DialogHeader>
      <DialogBody>
        {actions.canConfigureNetwork ? (
          <SettingsForm draft={draft} onChange={edit} onPick={actions.pickFile} />
        ) : (
          <EmptyState icon={MonitorDown} title="Available in the desktop app" description={WEB_NOTICE} />
        )}
      </DialogBody>
      {actions.canConfigureNetwork && (
        <DialogFooter>
          {failure && <p role="alert" className="mr-auto min-w-0 self-center text-xs text-destructive">{failure}</p>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      )}
    </Dialog>
  )
}
