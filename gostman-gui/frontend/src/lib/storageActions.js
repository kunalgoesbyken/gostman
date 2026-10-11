import { pluralize } from './dataUtils'
import { useAppStore } from '../store/appStore'

const OPEN_FAILED = 'Could not open the folder'
const SAVE_FAILED = 'Could not save the collection to the folder'
const RELOAD_FAILED = 'Could not reload the folder'
const CLOSE_FAILED = 'Could not close the folder'
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

  return {
    status: storage.status,
    showProblems,
    openFolder: attempt(OPEN_FAILED, pickThen(storage.openFolder)),
    saveToFolder: attempt(SAVE_FAILED, pickThen(storage.saveToFolder)),
    reopen: attempt(OPEN_FAILED, (path) => switchAndReport(() => storage.openFolder(path))),
    reload: attempt(RELOAD_FAILED, () => switchAndReport(storage.reload)),
    close: attempt(CLOSE_FAILED, () => switchAndReport(storage.close)),
  }
}
