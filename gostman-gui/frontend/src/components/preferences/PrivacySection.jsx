import { useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { SegmentedControl } from "../ui/segmented"
import { PreferenceRow, optionsOf } from "./PreferenceRows"
import { openExternal } from "../../lib/about"
import { WEB_APP_URL } from "../../lib/constants"
import { PRIVACY_TEXT as TEXT } from "../../lib/privacyText"
import { RELAY_LOCAL, RELAY_MODES, RelayUnreachableError, relayOrigin, updateRelay, useRelayStore } from "../../lib/relay"
import { cn } from "../../lib/utils"

const PRIVACY_DOCS_URL = `${WEB_APP_URL}/docs/getting-started#what-gostman-connects-to`
const IDLE = { state: "idle", message: "" }
const CHECKING = "checking"
const FAILED = "failed"

const checkFailure = (error) => (
  error instanceof RelayUnreachableError ? TEXT.relayCheckUnreachable(error.origin) : error?.message || String(error)
)

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

export function PrivacySection({ relay }) {
  return (
    <>
      <PreferenceRow label={TEXT.telemetryLabel} hint={TEXT.telemetryHint}>
        <a href={PRIVACY_DOCS_URL} target="_blank" rel="noreferrer" onClick={(event) => openExternal(event, PRIVACY_DOCS_URL)} className="text-xs text-primary hover:underline">
          {TEXT.docsLink}
        </a>
      </PreferenceRow>
      {relay && <RelayRows relay={relay} />}
    </>
  )
}
