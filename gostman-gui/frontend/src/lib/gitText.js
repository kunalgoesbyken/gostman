import english from '../../../../locales/en/git.json'
import { messages } from './i18n/core'

const text = messages('git', english, (t) => ({
  git: {
    scope: (folder) => `${folder}/`,
    pull: (behind) => t(behind > 0 ? 'git.pullBehind' : 'git.pull', { count: behind }),
    push: (ahead) => t(ahead > 0 ? 'git.pushAhead' : 'git.push', { count: ahead }),
    fetched: ({ behind }) => t(behind > 0 ? 'git.fetchedBehind' : 'git.fetchedNothing', { count: behind }),
    pushed: ({ upstream }) => (upstream ? t('git.pushedTo', { upstream }) : t('git.pushed')),
    sectionTitle: (title, count) => t('git.sectionTitle', { title, count }),
    get statusLabels() {
      const label = (name) => t(`git.statusLabels.${name}`)
      return {
        M: label('modified'),
        A: label('added'),
        D: label('deleted'),
        R: label('renamed'),
        C: label('copied'),
        T: label('typeChanged'),
        U: label('new'),
        '?': label('new'),
      }
    },
    remotePlaceholder: 'https://github.com/owner/repository.git',
  },
  gitSession: {
    restoreMessage: (path, commit) => t('gitSession.restoreMessage', { path, commit }),
  },
}))

export const GIT_TEXT = text.git
export const GIT_SESSION_TEXT = text.gitSession
