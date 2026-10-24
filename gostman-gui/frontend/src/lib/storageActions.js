import { pluralize } from './dataUtils'
import { createGitActions } from './gitSession'
import { WORKSPACE_TEXT as TEXT } from './workspaceText'
import { useAppStore } from '../store/appStore'

const CLONE_TITLE = 'Clone repository'
const CLONE_MESSAGE = 'Address of the repository to clone. Sign-in uses your git credential helper or SSH agent. Next, choose the folder to clone into.'
const CLONE_PLACEHOLDER = 'https://github.com/owner/repository.git'
const TRUST_PROMPT = 'Requests in this folder can carry scripts, OAuth 2.0 settings, commands that start local MCP servers and {{$file(...)}} placeholders that send files from this computer. They run when a request is sent and can read your variables, so trust the folder only if you know where its files came from.'
const SKIPPED_NOTE = 'These files were skipped and left unchanged. Fix them, then choose Reload from disk.'

const store = () => useAppStore.getState()
const messageOf = (error) => error?.message || String(error)

const describeProblem = ({ path, line, message }) => (line ? `${path} (line ${line}): ${message}` : `${path}: ${message}`)

function showProblems(problems) {
  if (problems.length === 0) return
  const title = `${pluralize(problems.length, 'file')} could not be read`
  store().showAlert(title, [SKIPPED_NOTE, ...problems.map(describeProblem)].join('\n'), 'OK', 'warning')
}

const attempt = (failureTitle, run) => async (...args) => {
  try {
    await run(...args)
  } catch (error) {
    store().showAlert(failureTitle, messageOf(error), 'OK', 'warning')
  }
}

export function createStorageActions(backend) {
  const { storage } = backend
  if (!storage) return null

  function switchStorage(change) {
    const { folders, environments, activeEnvironmentId } = store()
    const switched = storage.change(async () => {
      await backend.saveFolders(folders)
      await backend.saveEnvironments(environments, activeEnvironmentId)
      const status = await change()
      store().enterWorkspace(status)
      return status
    })
    store().suspendPersistence()
    return switched
  }

  const switchAndReport = async (change) => {
    const status = await switchStorage(change)
    if (status.notice) store().showNotice(status.notice)
    showProblems(status.problems)
  }

  const pickThen = (use) => async () => {
    const path = await storage.pickFolder()
    if (path) await switchAndReport(() => use(path))
  }

  const clone = attempt(TEXT.cloneFailed, async (address) => {
    const parent = await storage.pickFolder()
    if (parent) await switchAndReport(() => storage.git.clone(address.trim(), parent))
  })

  const promptClone = () => store().showPrompt(CLONE_TITLE, CLONE_MESSAGE, '', CLONE_PLACEHOLDER, (address) => {
    if (address?.trim()) clone(address)
  })

  const git = createGitActions(storage.git)

  const trust = attempt(TEXT.trustFailed, async () => {
    await storage.trust()
    store().liftRestriction()
    await git.refreshState()
  })

  const confirmTrust = () => store().showConfirm('Trust this folder?', TRUST_PROMPT, trust, null, 'default', 'Trust')

  const adopt = (status) => store().adoptWorkspaceStatus(status)

  const pin = attempt(TEXT.pinFailed, async (path, pinned) => adopt(await storage.pin(path, pinned)))

  const rename = attempt(TEXT.renameFailed, async (path, name) => adopt(await storage.rename(path, name)))

  const forget = attempt(TEXT.forgetFailed, async (path) => {
    adopt(await storage.forget(path))
    store().leaveWorkspace(path)
  })

  const reveal = attempt(TEXT.revealFailed, (path) => storage.reveal(path))

  const promptRename = (entry) => store().showPrompt(
    TEXT.renameTitle,
    TEXT.renameMessage,
    entry.name,
    '',
    (name) => rename(entry.path, name ?? ''),
  )

  const confirmForget = (entry) => store().showConfirm(
    TEXT.forgetTitle,
    TEXT.forgetMessage(entry.name),
    () => forget(entry.path),
    null,
    'destructive',
    TEXT.forgetConfirm,
  )

  const refresh = attempt(TEXT.listFailed, async () => {
    const status = await storage.status()
    adopt(status)
    if (status.notice) store().showAlert(TEXT.alertTitle, status.notice, 'OK', 'warning')
  })

  const reopen = attempt(TEXT.openFailed, (path) => switchAndReport(() => storage.openFolder(path)))

  const adoptDiskChange = attempt(TEXT.reloadFailed, async () => {
    if (!store().hydrated) return
    const [data, status] = await Promise.all([backend.load(), storage.status()])
    store().hydrate(data)
    adopt(status)
    store().showNotice(status.problems.length > 0 ? TEXT.diskReloadedWithProblems(status.problems.length) : TEXT.diskReloaded)
  })

  const cycle = (step) => {
    const reachable = store().workspaceStatus.workspaces.filter((entry) => !entry.missing)
    if (reachable.length < 2) return
    const index = reachable.findIndex((entry) => entry.current)
    const from = index < 0 && step < 0 ? 0 : index
    reopen(reachable[(from + step + reachable.length) % reachable.length].path)
  }

  return {
    refresh,
    followDisk: () => storage.onDiskChange(adoptDiskChange),
    cycle,
    openSwitcher: () => store().setWorkspaceMenuOpen(true),
    confirmTrust,
    git,
    promptClone,
    showProblems,
    pin,
    promptRename,
    confirmForget,
    reveal,
    openFolder: attempt(TEXT.openFailed, pickThen(storage.openFolder)),
    saveToFolder: attempt(TEXT.saveFailed, pickThen(storage.saveToFolder)),
    reopen,
    reload: attempt(TEXT.reloadFailed, () => switchAndReport(storage.reload)),
    close: attempt(TEXT.closeFailed, () => switchAndReport(storage.close)),
  }
}
