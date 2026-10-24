import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { MethodTag } from "./MethodTag"
import { pluralize } from "../lib/dataUtils"
import { CREDENTIAL_PASSPHRASE, credentialNeeded, openShare, readShareReference } from "../lib/share"
import { describeShared, readShared } from "../lib/shareContent"

const IDLE = { status: "idle" }
const OPENING = { status: "opening" }
const READY = "ready"
const FAILED = "failed"

const CREDENTIAL_FIELDS = {
  key: { label: "Key", hint: "This file was sent without its key. Paste the key the sender gave you.", type: "text" },
  passphrase: { label: "Passphrase", hint: "This share is locked with a passphrase. Ask the sender for it.", type: "password" },
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
        <Button type="submit" size="sm" disabled={credential.trim() === "" || isOpening}>Open</Button>
      </div>
    </form>
  )
}

function environmentLine({ name, variableCount, valueCount }) {
  const values = valueCount === 0 ? "names only, no values" : `${valueCount} with a value`
  return `${name}: ${pluralize(variableCount, "variable")}, ${values}`
}

function SharePreview({ summary }) {
  const { requests, folders, environments, activeCount, exampleCount, warnings } = summary
  return (
    <div className="flex min-h-0 flex-col gap-2 text-xs">
      <p className="font-medium text-foreground">
        {pluralize(requests.length, "request")}, {pluralize(folders.length, "folder")} and {pluralize(environments.length, "environment")}
      </p>
      {folders.length > 0 && (
        <p className="text-muted-foreground [overflow-wrap:anywhere]">Folders: {folders.map((folder) => folder.name).join(", ")}</p>
      )}
      {environments.map((environment, index) => (
        <p key={index} className="text-muted-foreground [overflow-wrap:anywhere]">{environmentLine(environment)}</p>
      ))}
      {environments.length > 0 && (
        <p className="text-muted-foreground">Variables you already have keep your values.</p>
      )}
      {exampleCount > 0 && <p className="text-muted-foreground">{pluralize(exampleCount, "saved example response")}</p>}
      {activeCount > 0 && (
        <p className="text-warning">
          {pluralize(activeCount, "item")} carry scripts, OAuth 2.0 settings, local MCP commands or file reads. You are asked before those are imported.
        </p>
      )}
      {warnings.map((warning) => <p key={warning} className="text-warning">{warning}</p>)}
      <ul aria-label="Shared requests" className="max-h-48 min-h-0 overflow-y-auto rounded-md border border-border py-1">
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

  const confirm = () => {
    onImport(state.imported)
    onDone()
  }

  if (state.status === READY) {
    return (
      <div className="flex min-h-0 flex-col gap-3">
        <SharePreview summary={state.summary} />
        <div className="flex shrink-0 justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={confirm}>Import</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {kind !== "" && <CredentialForm kind={kind} isOpening={isOpening} onSubmit={open} />}
      {isOpening && (
        <p role="status" className="text-xs text-muted-foreground">
          {kind === CREDENTIAL_PASSPHRASE ? "Deriving the key and decrypting" : "Decrypting"}
        </p>
      )}
      {state.status === FAILED && <Failure>{state.error}</Failure>}
    </div>
  )
}
