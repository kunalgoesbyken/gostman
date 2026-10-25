import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
import { CopyTextButton } from "./CopyTextButton"
import { ScanNotice } from "./ScanNotice"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { OpenLinkBuilder } from "./OpenLinkBuilder"
import { SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { useSecretScan } from "../hooks/useSecretScan"
import { buildCollectionTree, listFolders, ROOT_ID } from "../lib/collectionTree"
import { formatSize } from "../lib/dataUtils"
import { SCAN_TEXT } from "../lib/scanText"
import { SHARE_TEXT } from "../lib/shareText"
import {
  MAX_LINK_FRAGMENT_LENGTH, MIN_PASSPHRASE_LENGTH, SHARE_FILE_EXTENSION,
  createShare, fitsInLink, fragmentLength, shareFileText, shareKey, shareLink,
} from "../lib/share"
import { buildSharedExport, countLiteralCredentials, sharedCollectionVariableNames, sharedVariableNames } from "../lib/shareContent"

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
  { value: PROTECT_KEY, label: SHARE_TEXT.protections.key },
  { value: PROTECT_PASSPHRASE, label: SHARE_TEXT.protections.passphrase },
]

const DELIVERIES = [
  { value: SEND_LINK, label: SHARE_TEXT.deliveries.link },
  { value: SEND_FILE, label: SHARE_TEXT.deliveries.file },
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

function LinkOutput({ share, linkBase, usesPassphrase }) {
  if (!fitsInLink(share)) {
    return (
      <p role="status" className="text-xs text-warning">
        {SHARE_TEXT.tooLong(formatSize(fragmentLength(share)), formatSize(MAX_LINK_FRAGMENT_LENGTH))}
      </p>
    )
  }
  const link = shareLink(linkBase, share)
  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <p className={`min-w-0 flex-1 ${NOTE_CLASS}`}>
          {SHARE_TEXT.linkNote(usesPassphrase, formatSize(link.length))}
        </p>
        <CopyTextButton text={link} />
      </div>
      <Textarea readOnly value={link} aria-label={SHARE_TEXT.linkLabel} className="min-h-16 flex-1 break-all" onFocus={(event) => event.target.select()} />
    </>
  )
}

function FileOutput({ share, usesPassphrase, onSaveFile }) {
  const key = shareKey(share)
  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <p className={`min-w-0 flex-1 ${NOTE_CLASS}`}>
          {SHARE_TEXT.fileNote(usesPassphrase)}
        </p>
        <Button size="sm" onClick={() => onSaveFile(FILE_NAME, shareFileText(share), FILE_MIME)}>
          <Download />
          {SHARE_TEXT.saveFile}
        </Button>
      </div>
      {key && (
        <div className="flex shrink-0 items-center gap-2">
          <Input readOnly value={key} aria-label={SHARE_TEXT.keyLabel} className="font-mono" onFocus={(event) => event.target.select()} />
          <CopyTextButton text={key} />
        </div>
      )}
    </>
  )
}

export function ShareTab({ requests, folders, environments, collectionVariables, settings, sharedOrder, initialFolderId, linkBase, scan, onGoToRequest, onSaveFile }) {
  const [folderId, setFolderId] = useState(initialFolderId)
  const [includeVariables, setIncludeVariables] = useState(false)
  const [includeExamples, setIncludeExamples] = useState(false)
  const [protection, setProtection] = useState(PROTECT_KEY)
  const [passphrase, setPassphrase] = useState("")
  const [delivery, setDelivery] = useState(SEND_LINK)

  const scopes = useMemo(() => listFolders(buildCollectionTree(folders, [])), [folders])
  const sharedRequest = requests.find((request) => request.id === initialFolderId)
  const requestPath = sharedRequest && [...(scopes.find(({ folder }) => folder.id === sharedRequest.folderId)?.path || []), sharedRequest.name]
  const exported = useMemo(
    () => buildSharedExport({ requests, folders, environments, collectionVariables, settings, sharedOrder }, { folderId, includeVariables, includeExamples }),
    [requests, folders, environments, collectionVariables, settings, sharedOrder, folderId, includeVariables, includeExamples]
  )
  const selection = exported.gostman
  const text = useMemo(() => JSON.stringify(exported), [exported])
  const variableNames = useMemo(() => sharedVariableNames(exported), [exported])
  const collectionVariableNames = useMemo(() => sharedCollectionVariableNames(exported), [exported])
  const literalCount = useMemo(() => countLiteralCredentials([...selection.requests, ...selection.folders]), [selection])

  const scanState = useSecretScan(scan, selection, false)
  const [reviewedReport, setReviewedReport] = useState(null)
  const hasFindings = (scanState.report?.findings.length ?? 0) > 0
  const isHeld = scanState.isScanning || (hasFindings && reviewedReport !== scanState.report)

  const usesPassphrase = protection === PROTECT_PASSPHRASE
  const isEmpty = selection.requests.length === 0 && selection.folders.length === 0
  const isReady = !isEmpty && !isHeld && (!usesPassphrase || passphrase.length >= MIN_PASSPHRASE_LENGTH)
  const { share, error } = useCreatedShare(text, usesPassphrase ? passphrase : "", isReady)

  return (
    <>
      <div className="flex shrink-0 flex-col gap-2">
        <Field label={SHARE_TEXT.scopeField}>
          <Select value={folderId} onChange={(event) => setFolderId(event.target.value)} aria-label={SHARE_TEXT.scopeLabel}>
            <option value={ROOT_ID}>{SHARE_TEXT.everything}</option>
            {sharedRequest && <option value={sharedRequest.id}>{SHARE_TEXT.requestScope(requestPath.join(PATH_SEPARATOR))}</option>}
            {scopes.map(({ folder, path }) => (
              <option key={folder.id} value={folder.id}>{path.join(PATH_SEPARATOR)}</option>
            ))}
          </Select>
        </Field>
        <Checkbox checked={includeVariables} onChange={(event) => setIncludeVariables(event.target.checked)} className={CHECKBOX_CLASS}>
          {SHARE_TEXT.includeVariables}
        </Checkbox>
        <Checkbox checked={includeExamples} onChange={(event) => setIncludeExamples(event.target.checked)} className={CHECKBOX_CLASS}>
          {SHARE_TEXT.includeExamples}
        </Checkbox>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl label={SHARE_TEXT.protection} options={PROTECTIONS} value={protection} onChange={setProtection} />
          {usesPassphrase && (
            <Input
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder={SHARE_TEXT.passphrasePlaceholder(MIN_PASSPHRASE_LENGTH)}
              aria-label={SHARE_TEXT.passphraseLabel}
              autoComplete="off"
              className="min-w-48 flex-1 font-mono"
            />
          )}
          <SegmentedControl label={SHARE_TEXT.sendAs} options={DELIVERIES} value={delivery} onChange={setDelivery} className="ml-auto" />
        </div>
      </div>

      <p className={`shrink-0 ${NOTE_CLASS}`}>
        {SHARE_TEXT.summary(selection, includeVariables)}
      </p>
      {folderId && !isEmpty && (
        <p className={`shrink-0 ${NOTE_CLASS}`}>{SHARE_TEXT.sharedVariables(variableNames)}</p>
      )}
      {collectionVariableNames.length > 0 && (
        <p className={`shrink-0 ${NOTE_CLASS}`}>{SHARE_TEXT.sharedCollectionVariables(collectionVariableNames)}</p>
      )}
      {literalCount > 0 && (
        <p className="shrink-0 text-xs text-warning">
          {SHARE_TEXT.literalCredentials(literalCount)}
        </p>
      )}

      <ScanNotice state={scanState} advice={SCAN_TEXT.foundShare} onGoToRequest={onGoToRequest}>
        {isHeld && !scanState.isScanning && (
          <Button size="sm" onClick={() => setReviewedReport(scanState.report)}>{SCAN_TEXT.shareAnyway}</Button>
        )}
      </ScanNotice>
      {isEmpty && <p role="status" className={NOTE_CLASS}>{SHARE_TEXT.nothing}</p>}
      {error && <p role="alert" className="text-xs text-destructive [overflow-wrap:anywhere]">{error}</p>}
      {share && delivery === SEND_LINK && <LinkOutput share={share} linkBase={linkBase} usesPassphrase={usesPassphrase} />}
      {share && delivery === SEND_FILE && <FileOutput share={share} usesPassphrase={usesPassphrase} onSaveFile={onSaveFile} />}
      <OpenLinkBuilder linkBase={linkBase} />
    </>
  )
}
