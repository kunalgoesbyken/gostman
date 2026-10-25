import { useCallback } from "react"
import { KeyRound, Search, X } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { FIELD_COLUMNS, Field } from "./ui/field"
import { Select } from "./ui/select"
import { SecretInput, TextInput } from "./AuthInputs"
import { openExternal } from "../lib/about"
import { formatDateTime } from "../lib/i18n/format"
import { isWebAddress } from "../lib/webAddress"
import {
  GRANTS,
  GRANT_AUTHORIZATION_CODE,
  GRANT_DEVICE_CODE,
  GRANT_PASSWORD,
  callbackUrlFor,
  hasToken,
  isOtherEnvironment,
  isTokenFresh,
  sentToken,
} from "../lib/oauth"
import { OAUTH_TEXT as TEXT } from "../lib/oauthText"
import { cn } from "../lib/utils"
import { findActiveEnvironment, useAppStore } from "../store/appStore"

const CREDENTIALS_IN_HEADER = "header"
const CREDENTIALS_IN_BODY = "body"
const CHECKBOX_CLASS = "h-7 justify-start self-start"

function pendingSummary(config, tokenRequest) {
  if (tokenRequest.isDiscovering) return TEXT.discovering
  if (tokenRequest.device) return TEXT.waitingForDevice
  return config.grant === GRANT_AUTHORIZATION_CODE ? TEXT.waitingForBrowser : TEXT.requesting
}

function tokenSummary(config, tokenRequest, environmentId) {
  if (tokenRequest?.isPending) return pendingSummary(config, tokenRequest)
  if (tokenRequest?.notice) return tokenRequest.notice
  if (!hasToken(config)) return TEXT.noToken
  if (isOtherEnvironment(config, environmentId)) return TEXT.otherEnvironment
  if (sentToken(config) === "") return TEXT.noIdToken
  if (config.expiresAt === 0) return TEXT.noExpiry
  const expiry = formatDateTime(config.expiresAt)
  return isTokenFresh(config) ? TEXT.expires(expiry) : TEXT.expired(expiry)
}

function DeviceCode({ device }) {
  const revealRef = useCallback((element) => element?.scrollIntoView({ block: "nearest" }), [])
  return (
    <div ref={revealRef} className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{TEXT.deviceCode}</span>
      <span className="select-all font-mono text-base tracking-widest text-foreground">{device.userCode}</span>
      {isWebAddress(device.verificationUri) && <a
        href={device.verificationUri}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => openExternal(event, device.verificationUri)}
        className="self-start text-primary underline-offset-2 hover:underline"
      >
        {TEXT.openSignInPage}
      </a>}
    </div>
  )
}

function TokenControls({ config, environmentId, tokenRequest, actions, onClear }) {
  const isPending = Boolean(tokenRequest?.isPending)
  const isDiscovering = Boolean(tokenRequest?.isDiscovering)
  const error = tokenRequest?.error || ""

  return (
    <div className={cn(FIELD_COLUMNS, "items-start")}>
      <span className="max-sm:hidden" />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          {isPending && !isDiscovering ? (
            <Button variant="outline" size="sm" onClick={actions.cancelToken}>
              <X />
              {TEXT.cancel}
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={isDiscovering} onClick={actions.getToken}>
              <KeyRound />
              {TEXT.getToken}
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={isPending || !hasToken(config)} onClick={onClear}>
            {TEXT.clearToken}
          </Button>
        </div>
        {tokenRequest?.device && <DeviceCode device={tokenRequest.device} />}
        <p role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {error || tokenSummary(config, tokenRequest, environmentId)}
        </p>
      </div>
    </div>
  )
}

function IssuerField({ config, tokenRequest, onChange, onDiscover }) {
  return (
    <Field label={TEXT.fields.issuer}>
      <div className="flex min-w-0 items-center gap-2">
        <TextInput value={config.issuer} onChange={onChange} placeholder={TEXT.fields.issuerPlaceholder} />
        <Button
          variant="outline"
          size="sm"
          title={TEXT.discoverTitle}
          disabled={!config.issuer.trim() || Boolean(tokenRequest?.isPending)}
          onClick={onDiscover}
        >
          <Search />
          {TEXT.discover}
        </Button>
      </div>
    </Field>
  )
}

export function OAuthFields({ auth, onFieldChange, tokenRequest, actions }) {
  const config = auth.oauth2
  const environmentId = useAppStore((state) => findActiveEnvironment(state)?.id || "")
  const onConfigChange = (field) => (value) => onFieldChange("oauth2")({ ...config, [field]: value })
  const onTokenChange = (field) => (value) => onFieldChange("oauth2")({ ...config, [field]: value, tokenEnvironment: environmentId })
  const usesBrowser = config.grant === GRANT_AUTHORIZATION_CODE
  const usesDevice = config.grant === GRANT_DEVICE_CODE
  const callback = actions.oauthCallback

  return (
    <>
      <Field label={TEXT.fields.grant}>
        <Select value={config.grant} onChange={(event) => onConfigChange("grant")(event.target.value)}>
          {GRANTS.map((grant) => (
            <option key={grant.value} value={grant.value}>{grant.label}</option>
          ))}
        </Select>
      </Field>
      <IssuerField config={config} tokenRequest={tokenRequest} onChange={onConfigChange("issuer")} onDiscover={actions.discoverEndpoints} />
      {usesBrowser && (
        <>
          <Field label={TEXT.fields.authUrl}>
            <TextInput value={config.authUrl} onChange={onConfigChange("authUrl")} placeholder={TEXT.fields.authUrlPlaceholder} />
          </Field>
          <Field label={TEXT.fields.callbackUrl}>
            <TextInput
              value={callback.isFixed ? callback.url : config.callbackUrl}
              onChange={onConfigChange("callbackUrl")}
              placeholder={callback.url}
              readOnly={callback.isFixed}
              title={TEXT.fields.callbackTitle(callbackUrlFor(callback, config))}
            />
          </Field>
        </>
      )}
      {usesDevice && (
        <Field label={TEXT.fields.deviceUrl}>
          <TextInput value={config.deviceUrl} onChange={onConfigChange("deviceUrl")} placeholder={TEXT.fields.deviceUrlPlaceholder} />
        </Field>
      )}
      <Field label={TEXT.fields.tokenUrl}>
        <TextInput value={config.tokenUrl} onChange={onConfigChange("tokenUrl")} placeholder={TEXT.fields.tokenUrlPlaceholder} />
      </Field>
      <Field label={TEXT.fields.clientId}>
        <TextInput value={config.clientId} onChange={onConfigChange("clientId")} />
      </Field>
      <Field label={TEXT.fields.clientSecret}>
        <SecretInput value={config.clientSecret} onChange={onConfigChange("clientSecret")} />
      </Field>
      {config.grant === GRANT_PASSWORD && (
        <>
          <Field label={TEXT.fields.username}>
            <TextInput value={config.username} onChange={onConfigChange("username")} />
          </Field>
          <Field label={TEXT.fields.password}>
            <SecretInput value={config.password} onChange={onConfigChange("password")} />
          </Field>
        </>
      )}
      <Field label={TEXT.fields.scope}>
        <TextInput value={config.scope} onChange={onConfigChange("scope")} placeholder={TEXT.fields.scopePlaceholder} />
      </Field>
      <Field label={TEXT.fields.credentialsIn}>
        <Select
          value={config.credentialsIn || CREDENTIALS_IN_HEADER}
          onChange={(event) => onConfigChange("credentialsIn")(event.target.value)}
        >
          <option value={CREDENTIALS_IN_HEADER}>{TEXT.fields.credentialsHeader}</option>
          <option value={CREDENTIALS_IN_BODY}>{TEXT.fields.credentialsBody}</option>
        </Select>
      </Field>
      {usesBrowser && (
        <Checkbox checked={config.pkce} onChange={(event) => onConfigChange("pkce")(event.target.checked)} className={CHECKBOX_CLASS}>
          {TEXT.fields.pkce}
        </Checkbox>
      )}
      <Field label={TEXT.fields.headerPrefix}>
        <TextInput value={config.headerPrefix} onChange={onConfigChange("headerPrefix")} placeholder={TEXT.fields.headerPrefixPlaceholder} />
      </Field>
      <Checkbox checked={config.sendIdToken} onChange={(event) => onConfigChange("sendIdToken")(event.target.checked)} className={CHECKBOX_CLASS}>
        {TEXT.fields.sendIdToken}
      </Checkbox>
      {config.sendIdToken ? (
        <Field label={TEXT.fields.idToken}>
          <SecretInput value={config.idToken} onChange={onTokenChange("idToken")} />
        </Field>
      ) : (
        <Field label={TEXT.fields.accessToken}>
          <SecretInput value={config.accessToken} onChange={onTokenChange("accessToken")} />
        </Field>
      )}
      <TokenControls config={config} environmentId={environmentId} tokenRequest={tokenRequest} actions={actions} onClear={actions.forgetToken} />
    </>
  )
}
