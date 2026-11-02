import {
  DeleteMonitorWebhook,
  ForgetMonitorRuns,
  HasMonitorWebhook,
  MonitorRuns,
  NotifyMonitor,
  SaveMonitorRun,
  SaveMonitorWebhook,
} from '../../../wailsjs/go/main/App'

export const desktopMonitors = {
  runs: async (scope) => (await MonitorRuns(scope)) || [],
  save: (scope, record, keep) => SaveMonitorRun(scope, record, keep),
  forget: (scope) => ForgetMonitorRuns(scope),
  webhook: {
    has: (id) => HasMonitorWebhook(id),
    save: (id, address) => SaveMonitorWebhook(id, address),
    remove: (id) => DeleteMonitorWebhook(id),
    notify: (id, notice) => NotifyMonitor(id, notice),
  },
}
