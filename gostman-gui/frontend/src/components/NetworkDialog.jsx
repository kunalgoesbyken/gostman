import { useEffect, useState } from "react"
import { FolderOpen, MonitorDown, Plus, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { SectionLabel } from "./ui/panel"
import { Select } from "./ui/select"
import { BLANK_CERTIFICATE, PROXY_CUSTOM, PROXY_MODES, PROXY_NONE, hasCollectionNetwork } from "../lib/network"
import { NETWORK_TEXT as TEXT } from "../lib/networkText"

const CERTIFICATE_COLUMNS = "grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,1fr)_1.75rem] items-center gap-2"
const COLLECTION_COLUMNS = "grid grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)_minmax(0,1fr)_auto] items-center gap-2"

const messageOf = (error) => error?.message || String(error)

function PathField({ label, path, onPick, onClear }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button variant="outline" size="sm" onClick={onPick} aria-label={TEXT.chooseLabel(label)}>
        <FolderOpen />
        {TEXT.choose}
      </Button>
      <span title={path} className={`min-w-0 flex-1 truncate font-mono text-xs ${path ? "text-foreground" : "text-muted-foreground"}`}>
        {path || TEXT.noFile}
      </span>
      {onClear && path && <IconButton label={TEXT.clearLabel(label)} icon={X} size="icon-xs" onClick={onClear} />}
    </div>
  )
}

function PassphraseField({ value, saved, onChange, onForget }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Input
        type="password"
        value={value}
        placeholder={saved ? TEXT.passphraseSaved : TEXT.passphraseNone}
        aria-label={TEXT.passphrase}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      {saved && onForget && <IconButton label={TEXT.forgetPassphrase} icon={X} size="icon-xs" onClick={onForget} />}
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
        placeholder={TEXT.hostPlaceholder}
        aria-label={TEXT.hostLabel}
        spellCheck={false}
        onChange={(event) => onChange({ ...certificate, host: event.target.value })}
        className="font-mono"
      />
      <PathField label={TEXT.certificateFile} path={certificate.certFile} onPick={pickInto("certFile", TEXT.chooseCertificate)} />
      <PathField
        label={TEXT.keyFile}
        path={certificate.keyFile}
        onPick={pickInto("keyFile", TEXT.chooseKey)}
        onClear={() => onChange({ ...certificate, keyFile: "" })}
      />
      <PassphraseField
        value={certificate.passphrase}
        saved={certificate.passphraseSaved}
        onChange={(passphrase) => onChange({ ...certificate, passphrase })}
        onForget={() => onChange({ ...certificate, passphrase: "", passphraseSaved: false })}
      />
      <IconButton label={TEXT.removeCertificate} icon={X} onClick={onRemove} />
    </div>
  )
}

function SettingsForm({ draft, onChange, onPick }) {
  const update = (patch) => onChange({ ...draft, ...patch })
  const setCertificates = (certificates) => update({ certificates })
  const pickCA = async () => {
    const caFile = await onPick(TEXT.chooseCA)
    if (caFile) update({ caFile })
  }

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{TEXT.proxy}</SectionLabel>
      <Field label={TEXT.mode}>
        <Select value={draft.proxyMode} onChange={(event) => update({ proxyMode: event.target.value })}>
          {PROXY_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>{mode.label}</option>
          ))}
        </Select>
      </Field>
      {draft.proxyMode === PROXY_CUSTOM && (
        <Field label={TEXT.proxyAddress}>
          <Input
            value={draft.proxyUrl}
            placeholder={TEXT.proxyAddressPlaceholder}
            spellCheck={false}
            onChange={(event) => update({ proxyUrl: event.target.value })}
            className="font-mono"
          />
        </Field>
      )}
      {draft.proxyMode !== PROXY_NONE && (
        <Field label={TEXT.bypass}>
          <Input
            value={draft.proxyBypass}
            placeholder={TEXT.bypassPlaceholder}
            spellCheck={false}
            onChange={(event) => update({ proxyBypass: event.target.value })}
            className="font-mono"
          />
        </Field>
      )}

      <SectionLabel className="pt-3">{TEXT.certificates}</SectionLabel>
      <Field label={TEXT.caCertificate}>
        <PathField label={TEXT.caCertificate} path={draft.caFile} onPick={pickCA} onClear={() => update({ caFile: "" })} />
      </Field>

      {draft.certificates.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex min-w-[40rem] flex-col gap-2">
            <div className={`${CERTIFICATE_COLUMNS} pt-2`}>
              <SectionLabel className="truncate">{TEXT.certificateHost}</SectionLabel>
              <SectionLabel className="truncate">{TEXT.certificate}</SectionLabel>
              <SectionLabel className="truncate">{TEXT.privateKey}</SectionLabel>
              <SectionLabel className="truncate">{TEXT.passphrase}</SectionLabel>
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
          </div>
        </div>
      )}
      <Button variant="outline" size="sm" className="self-start" onClick={() => setCertificates([...draft.certificates, BLANK_CERTIFICATE])}>
        <Plus />
        {TEXT.addCertificate}
      </Button>
      <p className="text-xs text-muted-foreground">{TEXT.certificatesNote}</p>
    </div>
  )
}

function CollectionCertificate({ certificate, onSave }) {
  const [passphrase, setPassphrase] = useState("")
  const save = async (value) => {
    await onSave(certificate.host, certificate.certFile, value)
    setPassphrase("")
  }

  return (
    <div className={COLLECTION_COLUMNS}>
      <span className="truncate font-mono text-xs">{certificate.host}</span>
      <span title={certificate.certFile} className="truncate font-mono text-xs text-muted-foreground">{certificate.certFile}</span>
      <PassphraseField value={passphrase} saved={certificate.passphraseSaved} onChange={setPassphrase} onForget={() => save("")} />
      <Button variant="outline" size="sm" disabled={passphrase === ""} onClick={() => save(passphrase)}>{TEXT.savePassphrase}</Button>
    </div>
  )
}

function collectionState(status) {
  if (status.error) return { text: status.error, className: "text-destructive" }
  if (status.restricted) return { text: TEXT.collectionRestricted, className: "text-muted-foreground" }
  return { text: TEXT.collectionActive, className: "text-muted-foreground" }
}

function CollectionSection({ actions }) {
  const [status, setStatus] = useState(null)
  const [failure, setFailure] = useState("")
  const reload = () => actions.collectionNetwork().then(setStatus, (error) => setFailure(messageOf(error)))
  useEffect(() => {
    reload()
  }, [])

  if (!hasCollectionNetwork(status) && !failure) return null
  const savePassphrase = async (host, certFile, passphrase) => {
    try {
      await actions.saveCollectionPassphrase(host, certFile, passphrase)
      await reload()
    } catch (error) {
      setFailure(messageOf(error))
    }
  }
  const state = status ? collectionState(status) : { text: "", className: "" }
  const rows = status ? [[TEXT.collectionProxy, status.proxy], [TEXT.collectionBypass, status.noProxy], [TEXT.collectionCA, status.ca]].filter(([, value]) => value) : []

  return (
    <div className="flex flex-col gap-2 pt-3">
      <SectionLabel>{TEXT.collection}</SectionLabel>
      <p role={status?.error || failure ? "alert" : undefined} className={`text-xs ${failure ? "text-destructive" : state.className}`}>{failure || state.text}</p>
      {rows.map(([label, value]) => (
        <Field key={label} label={label}>
          <span className="truncate font-mono text-xs">{value}</span>
        </Field>
      ))}
      {status?.certificates?.map((certificate) => (
        <CollectionCertificate key={`${certificate.host}\n${certificate.certFile}`} certificate={certificate} onSave={savePassphrase} />
      ))}
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
    <Dialog label={TEXT.title} size={actions.canConfigureNetwork ? "lg" : "sm"} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{TEXT.title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        {actions.canConfigureNetwork ? (
          <>
            <SettingsForm draft={draft} onChange={edit} onPick={actions.pickFile} />
            <CollectionSection actions={actions} />
          </>
        ) : (
          <EmptyState icon={MonitorDown} title={TEXT.webNoticeTitle} description={TEXT.webNotice} />
        )}
      </DialogBody>
      {actions.canConfigureNetwork && (
        <DialogFooter>
          {failure && <p role="alert" className="mr-auto min-w-0 self-center text-xs text-destructive">{failure}</p>}
          <Button variant="outline" onClick={onClose}>{TEXT.cancel}</Button>
          <Button onClick={save}>{TEXT.save}</Button>
        </DialogFooter>
      )}
    </Dialog>
  )
}
