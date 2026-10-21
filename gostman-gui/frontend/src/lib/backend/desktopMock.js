import {
  ClearMockLog,
  MockConfig,
  MockFromSpec,
  MockRoutes,
  MockStatus,
  SaveMockConfig,
  StartMock,
  StopMock,
  UpdateMock,
} from '../../../wailsjs/go/main/App'
import { EventsOn } from '../../../wailsjs/runtime/runtime'

const REQUEST_EVENT = 'mock:request'

export const desktopMock = {
  routes: (sources, variables, config) => MockRoutes(sources, variables, config),
  start: (sources, variables, config) => StartMock(sources, variables, config),
  update: (sources, variables, config) => UpdateMock(sources, variables, config),
  stop: () => StopMock(),
  status: () => MockStatus(),
  clearLog: () => ClearMockLog(),
  loadConfig: () => MockConfig(),
  saveConfig: (config) => SaveMockConfig(config),
  fromSpec: (source) => MockFromSpec(source),
  onRequest: (listener) => EventsOn(REQUEST_EVENT, listener),
}
