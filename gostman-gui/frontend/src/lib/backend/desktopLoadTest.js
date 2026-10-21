import { RunLoadTest, StopLoadTest } from '../../../wailsjs/go/main/App'
import { EventsOn } from '../../../wailsjs/runtime/runtime'
import { withPreferredTimeout } from '../preferences'
import { toEngineRequest } from '../request'

const PROGRESS_EVENT = 'loadtest:progress'

export const desktopLoadTest = {
  run: (request, variables, config) => RunLoadTest(toEngineRequest(withPreferredTimeout(request), variables), config),
  stop: () => StopLoadTest(),
  onProgress: (listener) => EventsOn(PROGRESS_EVENT, listener),
}
