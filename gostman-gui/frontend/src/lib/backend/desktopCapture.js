import {
  CaptureStatus, CapturedDetails, CapturedExchanges, ClearCaptured, StartCapture, StopCapture,
} from '../../../wailsjs/go/main/App'
import { EventsOn } from '../../../wailsjs/runtime/runtime'

const EXCHANGE_EVENT = 'capture:exchange'

export const desktopCapture = {
  start: (settings) => StartCapture(settings),
  stop: () => StopCapture(),
  status: () => CaptureStatus(),
  list: () => CapturedExchanges(),
  details: (ids) => CapturedDetails(ids),
  clear: () => ClearCaptured(),
  onExchange: (listener) => EventsOn(EXCHANGE_EVENT, listener),
}
