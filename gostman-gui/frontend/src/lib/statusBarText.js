import english from '../../../../locales/en/statusBar.json'
import { messages } from './i18n/core'

const mockMessage = (isRunning, port) => {
  if (!isRunning) return 'statusBar.mockStopped'
  return port ? 'statusBar.mockRunningOn' : 'statusBar.mockRunning'
}

const text = messages('statusBar', english, (t) => ({
  statusBar: {
    mock: (isRunning, port) => t(mockMessage(isRunning, port), { port }),
    capture: (isRunning) => t(isRunning ? 'statusBar.captureRunning' : 'statusBar.captureStopped'),
  },
}))

export const STATUS_BAR_TEXT = text.statusBar
