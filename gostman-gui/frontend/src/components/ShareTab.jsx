import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
import { CopyTextButton } from "./CopyTextButton"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { buildCollectionTree, listFolders, ROOT_ID } from "../lib/collectionTree"
import { formatSize, pluralize } from "../lib/dataUtils"
import {
  MAX_LINK_FRAGMENT_LENGTH, MIN_PASSPHRASE_LENGTH, SHARE_FILE_EXTENSION,
  createShare, fitsInLink, fragmentLength, shareFileText, shareKey, shareLink,
} from "../lib/share"
import { buildSharedExport, countLiteralCredentials } from "../lib/shareContent"

const CREATE_DELAY_MS = 300
const PATH_SEPARATOR = " / "
const FILE_NAME = `collection.${SHARE_FILE_EXTENSION}`
const FILE_MIME = "text/plain"
const PROTECT_KEY = "key"
const PROTECT_PASSPHRASE = "passphrase"
const SEND_LINK = "link"
const SEND_FILE = "file"
const CHECKBOX_CLASS = "h-7 justify-start self-start"
const NOTE_CLASS = "text-xs text-muted-foreground [overflow-wrap:anywhere]"
const NOTHING = { share: null, error: "" }

const PROTECTIONS = [
  { value: PROTECT_KEY, label: "Random key" },
  { value: PROTECT_PASSPHRASE, label: "Passphrase" },
]

const DELIVERIES = [
  { value: SEND_LINK, label: "Link" },
  { value: SEND_FILE, label: "Encrypted file" },
]

const messageOf = (error) => error?.message || String(error)

function useCreatedShare(text, passphrase, isReady) {
  const [state, setState] = useState(NOTHING)

  useEffect(() => {
    setState(NOTHING)
    if (!isReady) return undefined
    let isCurrent = true
    const adopt = (next) => {
      if (isCurrent) setState(next)
    }
    const timer = setTimeout(() => {
      createShare(text, passphrase)
        .then((share) => adopt({ share, error: "" }))
        .catch((error) => adopt({ share: null, error: messageOf(error) }))
    }, CREATE_DELAY_MS)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [text, passphrase, isReady])

  return state
}

function describeSelection({ requests, folders, environments }, includeVariables) {
  const variables = includeVariables ? "with their values" : "variable names only"
  return `${pluralize(requests.length, "request")}, ${pluralize(folders.length, "folder")} and ${pluralize(environments.length, "environment")} (${variables}).`
}

function LinkOutput({ share, linkBase, usesPassphrase }) {
  if (!fitsInLink(share)) {
    return (
      <p role="status" className="text-xs text-warning">
        This selection needs a link of {formatSize(fragmentLength(share))}. Links stop at {formatSize(MAX_LINK_FRAGMENT_LENGTH)} because chat and mail apps cut longer ones short. Send it as an encrypted file instead.
      </p>
    )
  }
  const link = shareLink(linkBase, share)
  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <p className={`min-w-0 flex-1 ${NOTE_CLASS}`}>
          {usesPassphrase
            ? "The passphrase is not in the link. Tell the recipient through another channel."
            : "The key is part of the link, after the # sign, so anyone who has the whole link can read the collection."}
          {" "}{formatSize(link.length)}.
        </p>
        <CopyTextButton text={link} />
      </div>
      <Textarea readOnly value={link} aria-label="Share link" className="min-h-16 flex-1 break-all" onFocus={(event) => event.target.select()} />
    </>
  )
}

function FileOutput({ share, usesPassphrase, onSaveFile }) {
  const key = shareKey(share)
  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <p className={`min-w-0 flex-1 ${NOTE_CLASS}`}>
          {usesPassphrase
            ? "The recipient opens the file with your passphrase. Tell them through another channel."
            : "The file cannot be opened without the key below. Send the key through a different channel than the file."}
        </p>
        <Button size="sm" onClick={() => onSaveFile(FILE_NAME, shareFileText(share), FILE_MIME)}>
          <Download />
          Save file
        </Button>
      </div>
      {key && (
        <div className="flex shrink-0 items-center gap-2">
          <Input readOnly value={key} aria-label="Key" className="font-mono" onFocus={(event) => event.target.select()} />
          <CopyTextButton text={key} />
        </div>
      )}
    </>
  )
}

export function ShareTab({ requests, folders, environments, settings, initialFolderId, linkBase, onSaveFile }) {
  const [folderId, setFolderId] = useState(initialFolderId)
  const [includeVariables, setIncludeVariables] = useState(false)
  const [includeExamples, setIncludeExamples] = useState(false)
  const [protection, setProtection] = useState(PROTECT_KEY)
  const [passphrase, setPassphrase] = useState("")
  const [delivery, setDelivery] = useState(SEND_LINK)

  const scopes = useMemo(() => listFolders(buildCollectionTree(folders, [])), [folders])
  const exported = useMemo(
    () => buildSharedExport({ requests, folders, environments, settings }, { folderId, includeVariables, includeExamples }),
    [requests, folders, environments, settings, folderId, includeVariables, includeExamples]
  )
  const selection = exported.gostman
  const text = useMemo(() => JSON.stringify(exported), [exported])
  const literalCount = useMemo(() => countLiteralCredentials([...selection.requests, ...selection.folders]), [selection])

  const usesPassphrase = protection === PROTECT_PASSPHRASE
  const isEmpty = selection.requests.length === 0 && selection.folders.length === 0
  const isReady = !isEmpty && (!usesPassphrase || passphrase.length >= MIN_PASSPHRASE_LENGTH)
  const { share, error } = useCreatedShare(text, usesPassphrase ? passphrase : "", isReady)

  return (
    <>
      <div className="flex shrink-0 flex-col gap-2">
        <Field label="Share">
          <Select value={folderId} onChange={(event) => setFolderId(event.target.value)} aria-label="What to share">
            <option value={ROOT_ID}>Everything</option>
            {scopes.map(({ folder, path }) => (
              <option key={folder.id} value={folder.id}>{path.join(PATH_SEPARATOR)}</option>
            ))}
          </Select>
        </Field>
        <Checkbox checked={includeVariables} onChange={(event) => setIncludeVariables(event.target.checked)} className={CHECKBOX_CLASS}>
          Share variable values (off: only the variable names are shared)
        </Checkbox>
        <Checkbox checked={includeExamples} onChange={(event) => setIncludeExamples(event.target.checked)} className={CHECKBOX_CLASS}>
          Include saved example responses
        </Checkbox>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl label="Protection" options={PROTECTIONS} value={protection} onChange={setProtection} />
          {usesPassphrase && (
            <Input
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder={`Passphrase, at least ${MIN_PASSPHRASE_LENGTH} characters`}
              aria-label="Passphrase"
              autoComplete="off"
              className="min-w-48 flex-1 font-mono"
            />
          )}
          <SegmentedControl label="Send as" options={DELIVERIES} value={delivery} onChange={setDelivery} className="ml-auto" />
        </div>
      </div>

      <p className={`shrink-0 ${NOTE_CLASS}`}>
        {describeSelection(selection, includeVariables)} Encrypted in this window and never uploaded. OAuth tokens, cookies, history and network settings are never included.
      </p>
      {literalCount > 0 && (
        <p className="shrink-0 text-xs text-warning">
          {pluralize(literalCount, "request")} hold a password, token or key typed directly into the Auth tab. Those are part of the request and are shared with it.
        </p>
      )}

      {isEmpty && <p role="status" className={NOTE_CLASS}>There is nothing to share here yet.</p>}
      {error && <p role="alert" className="text-xs text-destructive [overflow-wrap:anywhere]">{error}</p>}
      {share && delivery === SEND_LINK && <LinkOutput share={share} linkBase={linkBase} usesPassphrase={usesPassphrase} />}
      {share && delivery === SEND_FILE && <FileOutput share={share} usesPassphrase={usesPassphrase} onSaveFile={onSaveFile} />}
    </>
  )
}
