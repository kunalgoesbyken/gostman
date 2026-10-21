import { pluralize } from './dataUtils'
import { createGitActions } from './gitSession'
import { useAppStore } from '../store/appStore'

const OPEN_FAILED = 'Could not open the folder'
const SAVE_FAILED = 'Could not save the collection to the folder'
const RELOAD_FAILED = 'Could not reload the folder'
const CLONE_FAILED = 'Could not clone the repository'
const CLONE_TITLE = 'Clone repository'
const CLONE_MESSAGE = 'Address of the repository to clone. Sign-in uses your git credential helper or SSH agent. Next, choose the folder to clone into.'
const CLONE_PLACEHOLDER = 'https://github.com/owner/repository.git'
const CLOSE_FAILED = 'Could not close the folder'
const TRUST_FAILED = 'Could not trust the folder'
const TRUST_PROMPT = 'Requests in this folder can carry scripts and OAuth 2.0 settings. They run when a request is sent and can read your variables, so trust the folder only if you know where its files came from.'
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
      return change()
    })
    store().suspendPersistence()
    return switched
  }

  const switchAndReport = async (change) => showProblems((await switchStorage(change)).problems)

  const pickThen = (use) => async () => {
    const path = await storage.pickFolder()
    if (path) await switchAndReport(() => use(path))
  }

  const clone = attempt(CLONE_FAILED, async (address) => {
    const parent = await storage.pickFolder()
    if (parent) await switchAndReport(() => storage.git.clone(address.trim(), parent))
  })

  const promptClone = () => store().showPrompt(CLONE_TITLE, CLONE_MESSAGE, '', CLONE_PLACEHOLDER, (address) => {
    if (address?.trim()) clone(address)
  })

  const trust = attempt(TRUST_FAILED, async () => {
    await storage.trust()
    store().liftRestriction()
  })

  const confirmTrust = () => store().showConfirm('Trust this folder?', TRUST_PROMPT, trust, null, 'default', 'Trust')

  return {
    status: storage.status,
    confirmTrust,
    git: createGitActions(storage.git),
    promptClone,
    showProblems,
    openFolder: attempt(OPEN_FAILED, pickThen(storage.openFolder)),
    saveToFolder: attempt(SAVE_FAILED, pickThen(storage.saveToFolder)),
    reopen: attempt(OPEN_FAILED, (path) => switchAndReport(() => storage.openFolder(path))),
    reload: attempt(RELOAD_FAILED, () => switchAndReport(storage.reload)),
    close: attempt(CLOSE_FAILED, () => switchAndReport(storage.close)),
  }
}
