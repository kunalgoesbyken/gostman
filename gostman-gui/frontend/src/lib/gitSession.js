import { create } from 'zustand'
import { DIALOG_TEXT } from './dialogText'
import { GIT_SESSION_TEXT, GIT_TEXT } from './gitText'
import { useAppStore } from '../store/appStore'

export const TAB_CHANGES = 'changes'
export const TAB_BRANCHES = 'branches'
export const TAB_STASHES = 'stashes'
export const TAB_HISTORY = 'history'
export const TAB_REMOTES = 'remotes'

const NO_STATE = { installed: true, installHint: '', hasFolder: false, isRepo: false, problem: '', restricted: false, branch: '', ahead: 0, behind: 0, changes: [], remotes: [] }

const INITIAL_STATE = {
  isOpen: false,
  isBusy: false,
  state: NO_STATE,
  tab: TAB_CHANGES,
  selection: null,
  diff: null,
  conflict: null,
  branches: [],
  stashes: [],
  history: { path: '', commits: [], version: null },
  output: '',
}

export const useGitStore = create(() => INITIAL_STATE)

const git = () => useGitStore.getState()
const patch = (changes) => useGitStore.setState(changes)
const app = () => useAppStore.getState()
const messageOf = (error) => error?.message || String(error)
const alertFailure = (error) => app().showAlert(GIT_TEXT.title, messageOf(error), DIALOG_TEXT.ok, 'warning')

export const openGit = () => patch({ isOpen: true })

export const isStaged = (change) => !change.conflict && !change.untracked && change.index !== '.'
export const hasWorktreeChange = (change) => change.untracked || (!change.conflict && change.worktree !== '.')

export function createGitActions(backend) {
  async function refreshState() {
    patch({ state: await backend.state() })
  }

  async function loadTab(tab) {
    if (tab === TAB_BRANCHES) patch({ branches: await backend.branches() })
    if (tab === TAB_STASHES) patch({ stashes: await backend.stashes() })
    if (tab === TAB_HISTORY) patch({ history: { path: '', commits: await backend.log(''), version: null } })
  }

  async function refresh() {
    await refreshState()
    if (git().state.isRepo) await loadTab(git().tab)
  }

  async function perform(operation, { filesChange = false, done = null } = {}) {
    patch({ isBusy: true })
    let succeeded = false
    try {
      const output = await operation()
      patch({ output: typeof output === 'string' ? output : '' })
      succeeded = true
    } catch (error) {
      alertFailure(error)
    } finally {
      if (filesChange) app().suspendPersistence()
      await refresh().catch(() => {})
      if (succeeded && done && !git().output.trim()) patch({ output: done(git().state) })
      patch({ isBusy: false })
    }
  }

  const confirmThen = (title, message, run, confirmText) => app().showConfirm(title, message, run, null, 'destructive', confirmText)

  async function select(change, staged) {
    patch({ selection: { path: change.path, staged, untracked: change.untracked, conflict: change.conflict }, diff: null, conflict: null })
    try {
      if (change.conflict) return patch({ conflict: await backend.conflict(change.path) })
      patch({ diff: await backend.diff(change.path, staged, change.untracked) })
    } catch (error) {
      alertFailure(error)
    }
  }

  const reselect = async () => {
    const { selection, state } = git()
    const change = selection && state.changes.find((candidate) => candidate.path === selection.path)
    if (!change) return patch({ selection: null, diff: null, conflict: null })
    await select(change, isStaged(change) && (selection.staged || !hasWorktreeChange(change)))
  }

  const withReselect = (operation, options) => async (...args) => {
    await perform(() => operation(...args), options)
    await reselect()
  }

  return {
    refresh: () => refresh().catch((error) => alertFailure(error)),
    close: () => patch({ isOpen: false, selection: null, diff: null, conflict: null }),
    refreshState,
    setTab: async (tab) => {
      patch({ tab })
      await loadTab(tab).catch((error) => alertFailure(error))
    },
    select,
    stage: withReselect((paths) => backend.stage(paths)),
    unstage: withReselect((paths) => backend.unstage(paths)),
    stageAll: withReselect(() => backend.stageAll()),
    discard: (change) => confirmThen(
      GIT_SESSION_TEXT.discardTitle,
      GIT_SESSION_TEXT.discardMessage(change.path),
      withReselect(() => backend.discard(change.path, change.untracked), { filesChange: true }),
      GIT_SESSION_TEXT.discardConfirm,
    ),
    commit: withReselect((message, stageAll) => backend.commit(message, stageAll)),
    fetch: () => perform(() => backend.fetch(), { done: GIT_TEXT.fetched }),
    pull: () => perform(() => backend.pull(), { filesChange: true }),
    push: () => perform(() => backend.push(), { done: GIT_TEXT.pushed }),
    init: () => perform(() => backend.init()),
    createBranch: (name) => perform(() => backend.createBranch(name), { filesChange: true }),
    switchBranch: (name, remote) => perform(() => backend.switchBranch(name, remote), { filesChange: true }),
    deleteBranch: (name) => confirmThen(
      GIT_SESSION_TEXT.deleteBranchTitle,
      GIT_SESSION_TEXT.deleteBranchMessage(name),
      () => perform(() => backend.deleteBranch(name, false)),
      GIT_SESSION_TEXT.deleteBranchConfirm,
    ),
    saveStash: (message) => perform(() => backend.saveStash(message), { filesChange: true }),
    applyStash: (index) => perform(() => backend.stashAction('apply', index), { filesChange: true }),
    popStash: (index) => perform(() => backend.stashAction('pop', index), { filesChange: true }),
    dropStash: (index) => confirmThen(
      GIT_SESSION_TEXT.dropStashTitle,
      GIT_SESSION_TEXT.dropStashMessage,
      () => perform(() => backend.stashAction('drop', index)),
      GIT_SESSION_TEXT.dropStashConfirm,
    ),
    showHistory: async (path) => {
      patch({ tab: TAB_HISTORY, history: { path, commits: [], version: null } })
      try {
        patch({ history: { path, commits: await backend.log(path), version: null } })
      } catch (error) {
        alertFailure(error)
      }
    },
    showVersion: async (commit) => {
      const { path } = git().history
      try {
        const version = await backend.version(commit.hash, path)
        patch({ history: { ...git().history, version: { ...version, commit } } })
      } catch (error) {
        alertFailure(error)
      }
    },
    restoreVersion: (commit) => {
      const { path } = git().history
      confirmThen(
        GIT_SESSION_TEXT.restoreTitle,
        GIT_SESSION_TEXT.restoreMessage(path, commit.short),
        () => perform(() => backend.restoreVersion(commit.hash, path), { filesChange: true }),
        GIT_SESSION_TEXT.restoreConfirm,
      )
    },
    resolve: withReselect((path, content) => backend.resolve(path, content), { filesChange: true }),
    abortMerge: () => confirmThen(
      GIT_SESSION_TEXT.abortMergeTitle,
      GIT_SESSION_TEXT.abortMergeMessage,
      () => perform(() => backend.abortMerge(), { filesChange: true }),
      GIT_SESSION_TEXT.abortMergeConfirm,
    ),
    addRemote: (name, url) => perform(() => backend.addRemote(name, url)),
    setRemoteUrl: (name, url) => perform(() => backend.setRemoteUrl(name, url)),
    openPullRequest: () => perform(() => backend.openPullRequest()),
  }
}
