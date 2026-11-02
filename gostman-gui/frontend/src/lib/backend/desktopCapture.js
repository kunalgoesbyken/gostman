import {
  CaptureConfig, CaptureStatus, CapturedDetails, CapturedExchanges, CapturedHAR, CapturedMockRule, ClearCaptured,
  DropHeld, ExportCaptureRules, HeldExchanges, ImportCaptureRules, ReleaseHeld, SaveCaptureConfig, StartCapture, StopCapture,
} from '../../../wailsjs/go/main/App'
import { EventsOn } from '../../../wailsjs/runtime/runtime'

const EXCHANGE_EVENT = 'capture:exchange'
const HELD_EVENT = 'capture:held'
const SETTLED_EVENT = 'capture:settled'

export const desktopCapture = {
  start: (settings) => StartCapture(settings),
  stop: () => StopCapture(),
  status: () => CaptureStatus(),
  list: () => CapturedExchanges(),
  details: (ids) => CapturedDetails(ids),
  clear: () => ClearCaptured(),
  loadConfig: () => CaptureConfig(),
  saveConfig: (config) => SaveCaptureConfig(config),
  exportRules: (rules) => ExportCaptureRules(rules),
  importRules: (text) => ImportCaptureRules(text),
  har: (ids) => CapturedHAR(ids),
  mockRule: (id) => CapturedMockRule(id),
  held: () => HeldExchanges(),
  release: (id, decision) => ReleaseHeld(id, decision),
  drop: (id) => DropHeld(id),
  onHeld: (listener) => EventsOn(HELD_EVENT, listener),
  onSettled: (listener) => EventsOn(SETTLED_EVENT, listener),
  onExchange: (listener) => EventsOn(EXCHANGE_EVENT, listener),
}
