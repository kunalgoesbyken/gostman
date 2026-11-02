import { useAppStore } from '../store/appStore'
import { watchesSpec } from './contractCheck'
import { SPEC_TEXT } from './specText'
import { isEmptyPlan } from './specSync'

const FILE_POLL_MS = 3000
const URL_RECHECK_MS = 10 * 60 * 1000

const store = () => useAppStore.getState()
const isFile = (link) => Boolean(link.source.path)

export function startSpecWatch(openapi) {
  const reported = new Map()
  const checkedAt = new Map()
  let busy = false

  const urlDue = (folderId) => Date.now() - (checkedAt.get(folderId) ?? 0) >= URL_RECHECK_MS
  const fileOnly = (folderId, link) => isFile(link)
  const dueOnFocus = (folderId, link) => isFile(link) || urlDue(folderId)

  function announce(folderId) {
    const folder = store().folders.find((candidate) => candidate.id === folderId)
    if (!folder) return
    store().showNotice(SPEC_TEXT.watchChanged(folder.name), null, { label: SPEC_TEXT.watchReview, run: () => openapi.check(folderId) })
  }

  async function inspect(folderId, link) {
    checkedAt.set(folderId, Date.now())
    const hash = await openapi.hash(link.source).catch(() => null)
    if (!hash || hash === link.hash || hash === reported.get(folderId)) return
    const plan = await openapi.planUpdates(folderId).catch(() => null)
    if (!plan) return
    reported.set(folderId, hash)
    if (!isEmptyPlan(plan)) announce(folderId)
  }

  async function scan(isDue) {
    if (busy) return
    busy = true
    try {
      for (const [folderId, link] of Object.entries(store().specLinks)) {
        if (watchesSpec(link) && isDue(folderId, link)) await inspect(folderId, link)
      }
    } finally {
      busy = false
    }
  }

  const scanOnFocus = () => scan(dueOnFocus)
  const timer = setInterval(() => scan(fileOnly), FILE_POLL_MS)
  window.addEventListener('focus', scanOnFocus)
  scanOnFocus()

  return () => {
    clearInterval(timer)
    window.removeEventListener('focus', scanOnFocus)
  }
}
