import {
  DeleteMonitorWebhook,
  MonitorRuns,
  NotifyMonitor,
  SaveMonitorRun,
  SaveMonitorWebhook,
} from '../../../wailsjs/go/main/App'

export const desktopMonitors = {
  runs: async (scope) => (await MonitorRuns(scope)) || [],
  save: (scope, record, keep) => SaveMonitorRun(scope, record, keep),
  webhook: {
    save: (id, address) => SaveMonitorWebhook(id, address),
    remove: (id) => DeleteMonitorWebhook(id),
    notify: (id, notice) => NotifyMonitor(id, notice),
  },
}
