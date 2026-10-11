import { MockRoutes, MockStatus, StartMock, StopMock, UpdateMock } from '../../../wailsjs/go/main/App'
import { EventsOn } from '../../../wailsjs/runtime/runtime'

const REQUEST_EVENT = 'mock:request'

export const desktopMock = {
  routes: (sources, variables) => MockRoutes(sources, variables),
  start: (sources, variables, settings) => StartMock(sources, variables, settings),
  update: (sources, variables) => UpdateMock(sources, variables),
  stop: () => StopMock(),
  status: () => MockStatus(),
  onRequest: (listener) => EventsOn(REQUEST_EVENT, listener),
}
