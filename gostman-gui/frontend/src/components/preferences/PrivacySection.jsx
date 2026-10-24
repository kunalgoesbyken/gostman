import { useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { SegmentedControl } from "../ui/segmented"
import { Switch } from "../ui/switch"
import { PreferenceRow, optionsOf } from "./PreferenceRows"
import { openExternal } from "../../lib/about"
import { WEB_APP_URL } from "../../lib/constants"
import { PRIVACY_TEXT as TEXT } from "../../lib/privacyText"
import { RELAY_LOCAL, RELAY_MODES, RelayUnreachableError, relayOrigin, updateRelay, useRelayStore } from "../../lib/relay"
import { setUpdateChecks, useUpdateStore } from "../../lib/updates"
import { cn } from "../../lib/utils"

const PRIVACY_DOCS_URL = `${WEB_APP_URL}/docs/getting-started#what-gostman-connects-to`
const IDLE = { state: "idle", message: "" }
const CHECKING = "checking"
const FAILED = "failed"

const checkFailure = (error) => (
  error instanceof RelayUnreachableError ? TEXT.relayCheckUnreachable(error.origin) : error?.message || String(error)
)

function updateStatus(state) {
  if (!state.enabled || state.checkedFor !== __APP_VERSION__) return ""
  if (state.failed) return TEXT.updatesFailed
  return state.latest ? TEXT.updatesNewer(state.latest.version) : TEXT.updatesCurrent(__APP_VERSION__)
}

function UpdateRow() {
  const enabled = useUpdateStore((state) => state.enabled)
  const status = useUpdateStore(updateStatus)

  return (
    <div className="space-y-1">
      <PreferenceRow label={TEXT.updatesLabel} hint={TEXT.updatesHint}>
        <Switch checked={enabled} label={TEXT.updatesLabel} onCheckedChange={setUpdateChecks} />
      </PreferenceRow>
      {status && <p role="status" className="text-2xs text-muted-foreground">{status}</p>}
    </div>
  )
}

function RelayRows({ relay }) {
  const mode = useRelayStore((state) => state.mode)
  const address = useRelayStore((state) => state.address)
  const [check, setCheck] = useState(IDLE)
  const isValid = relayOrigin(address) !== ""

  const changeAddress = (event) => {
    updateRelay({ address: event.target.value })
    setCheck(IDLE)
  }

  const test = async () => {
    setCheck({ state: CHECKING, message: TEXT.relayChecking })
    try {
      await relay.check()
      setCheck({ state: "reachable", message: TEXT.relayReachable })
    } catch (error) {
      setCheck({ state: FAILED, message: checkFailure(error) })
    }
  }

  return (
    <>
      <PreferenceRow label={TEXT.relayLabel} hint={TEXT.relayHint}>
        <SegmentedControl label={TEXT.relayLabel} options={optionsOf(RELAY_MODES, TEXT.relayModes)} value={mode} onChange={(value) => updateRelay({ mode: value })} />
      </PreferenceRow>
      {mode === RELAY_LOCAL && (
        <div className="space-y-1">
          <PreferenceRow label={TEXT.relayAddressLabel} hint={isValid || !address ? TEXT.relayAddressHint : TEXT.relayAddressInvalid}>
            <span className="flex items-center gap-2">
              <Input
                aria-label={TEXT.relayAddressLabel}
                aria-invalid={!isValid}
                spellCheck={false}
                placeholder={TEXT.relayAddressPlaceholder}
                value={address}
                onChange={changeAddress}
                className="w-48 font-mono"
              />
              <Button variant="outline" size="sm" disabled={!isValid || check.state === CHECKING} onClick={test}>
                {TEXT.relayCheck}
              </Button>
            </span>
          </PreferenceRow>
          {check.message && (
            <p role="status" className={cn("text-2xs", check.state === FAILED ? "text-destructive" : "text-muted-foreground")}>{check.message}</p>
          )}
        </div>
      )}
    </>
  )
}

export function PrivacySection({ relay, updates }) {
  return (
    <>
      <PreferenceRow label={TEXT.telemetryLabel} hint={TEXT.telemetryHint}>
        <a href={PRIVACY_DOCS_URL} target="_blank" rel="noreferrer" onClick={(event) => openExternal(event, PRIVACY_DOCS_URL)} className="text-xs text-primary hover:underline">
          {TEXT.docsLink}
        </a>
      </PreferenceRow>
      {updates && <UpdateRow />}
      {relay && <RelayRows relay={relay} />}
    </>
  )
}
