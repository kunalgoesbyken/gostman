import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { MethodTag } from "./MethodTag"
import { CREDENTIAL_PASSPHRASE, credentialNeeded, openShare, readShareReference } from "../lib/share"
import { describeShared, readShared } from "../lib/shareContent"
import { IMPORT_TEXT, collectionCounts } from "../lib/importText"
import { SHARE_OPEN_TEXT } from "../lib/shareText"

const IDLE = { status: "idle" }
const OPENING = { status: "opening" }
const READY = "ready"
const FAILED = "failed"

const CREDENTIAL_FIELDS = {
  key: { ...SHARE_OPEN_TEXT.credentials.key, type: "text" },
  passphrase: { ...SHARE_OPEN_TEXT.credentials.passphrase, type: "password" },
}

const messageOf = (error) => error?.message || String(error)

function readReference(reference) {
  try {
    return { share: readShareReference(reference), error: "" }
  } catch (error) {
    return { share: null, error: messageOf(error) }
  }
}

function useOpenedShare(share) {
  const [state, setState] = useState(IDLE)

  const open = useCallback(async (credential) => {
    setState(OPENING)
    try {
      const imported = await readShared(await openShare(share, credential))
      setState({ status: READY, imported, summary: describeShared(imported) })
    } catch (error) {
      setState({ status: FAILED, error: messageOf(error) })
    }
  }, [share])

  useEffect(() => {
    if (share && !credentialNeeded(share)) open("")
  }, [share, open])

  return { state, open }
}

function Failure({ children }) {
  return <p role="alert" className="text-xs text-destructive [overflow-wrap:anywhere]">{children}</p>
}

function CredentialForm({ kind, isOpening, onSubmit }) {
  const [credential, setCredential] = useState("")
  const field = CREDENTIAL_FIELDS[kind]

  const submit = (event) => {
    event.preventDefault()
    onSubmit(credential)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{field.hint}</p>
      <div className="flex items-center gap-2">
        <Input
          type={field.type}
          value={credential}
          onChange={(event) => setCredential(event.target.value)}
          placeholder={field.label}
          aria-label={field.label}
          autoComplete="off"
          autoFocus
          className="font-mono"
        />
        <Button type="submit" size="sm" disabled={credential.trim() === "" || isOpening}>{SHARE_OPEN_TEXT.open}</Button>
      </div>
    </form>
  )
}

function SharePreview({ summary }) {
  const { requests, folders, environments, activeCount, activeKinds, exampleCount, warnings } = summary
  return (
    <div className="flex min-h-0 flex-col gap-2 text-xs">
      <p className="font-medium text-foreground">
        {collectionCounts(summary)}
      </p>
      {folders.length > 0 && (
        <p className="text-muted-foreground [overflow-wrap:anywhere]">{SHARE_OPEN_TEXT.folders(folders.map((folder) => folder.name))}</p>
      )}
      {environments.map((environment, index) => (
        <p key={index} className="text-muted-foreground [overflow-wrap:anywhere]">{SHARE_OPEN_TEXT.environment(environment)}</p>
      ))}
      {environments.length > 0 && (
        <p className="text-muted-foreground">{SHARE_OPEN_TEXT.keepValues}</p>
      )}
      {exampleCount > 0 && <p className="text-muted-foreground">{SHARE_OPEN_TEXT.examples(exampleCount)}</p>}
      {activeCount > 0 && (
        <p className="text-warning">
          {SHARE_OPEN_TEXT.activeContent(activeCount, activeKinds)}
        </p>
      )}
      {warnings.map((warning) => <p key={warning} className="text-warning">{warning}</p>)}
      <ul aria-label={SHARE_OPEN_TEXT.requestsLabel} className="max-h-48 min-h-0 overflow-y-auto rounded-md border border-border py-1">
        {requests.map((request) => (
          <li key={request.id} className="flex items-center gap-2 px-2 py-0.5">
            <MethodTag method={request.method} className="w-12" />
            <span className="min-w-0 flex-1 truncate text-foreground" title={request.url}>{request.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ShareOpener({ reference, onImport, onCancel, onDone }) {
  const { share, error } = useMemo(() => readReference(reference), [reference])
  const { state, open } = useOpenedShare(share)

  if (error) return <Failure>{error}</Failure>

  const kind = credentialNeeded(share)
  const isOpening = state === OPENING

  const confirm = async () => {
    if (await onImport(state.imported)) onDone()
  }

  if (state.status === READY) {
    return (
      <div className="flex min-h-0 flex-col gap-3">
        <SharePreview summary={state.summary} />
        <div className="flex shrink-0 justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>{SHARE_OPEN_TEXT.cancel}</Button>
          <Button size="sm" onClick={confirm}>{IMPORT_TEXT.importButton}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {kind !== "" && <CredentialForm kind={kind} isOpening={isOpening} onSubmit={open} />}
      {isOpening && (
        <p role="status" className="text-xs text-muted-foreground">
          {kind === CREDENTIAL_PASSPHRASE ? SHARE_OPEN_TEXT.deriving : SHARE_OPEN_TEXT.decrypting}
        </p>
      )}
      {state.status === FAILED && <Failure>{state.error}</Failure>}
    </div>
  )
}
