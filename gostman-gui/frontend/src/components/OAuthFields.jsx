import { KeyRound, X } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Select } from "./ui/select"
import { SecretInput, TextInput } from "./AuthInputs"
import { GRANTS, GRANT_AUTHORIZATION_CODE, GRANT_PASSWORD, callbackUrlFor, hasToken, isTokenFresh } from "../lib/oauth"
import { cn } from "../lib/utils"

const CREDENTIALS_IN_HEADER = "header"
const CREDENTIALS_IN_BODY = "body"

function tokenSummary(config, tokenRequest) {
  if (tokenRequest?.isPending) {
    return config.grant === GRANT_AUTHORIZATION_CODE ? "Waiting for the sign-in to finish in your browser." : "Requesting a token."
  }
  if (!hasToken(config)) return "No token yet."
  if (config.expiresAt === 0) return "The provider did not report an expiry time."
  const expiry = new Date(config.expiresAt).toLocaleString()
  return isTokenFresh(config) ? `Expires ${expiry}.` : `Expired ${expiry}. A new token is requested when it can be renewed without signing in.`
}

function TokenControls({ config, tokenRequest, actions, onClear }) {
  const isPending = Boolean(tokenRequest?.isPending)
  const error = tokenRequest?.error || ""

  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-start gap-3">
      <span />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          {isPending ? (
            <Button variant="outline" size="sm" onClick={actions.cancelToken}>
              <X />
              Cancel
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={actions.getToken}>
              <KeyRound />
              Get token
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={isPending || !hasToken(config)} onClick={onClear}>
            Clear token
          </Button>
        </div>
        <p role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {error || tokenSummary(config, tokenRequest)}
        </p>
      </div>
    </div>
  )
}

export function OAuthFields({ auth, onFieldChange, tokenRequest, actions }) {
  const config = auth.oauth2
  const onConfigChange = (field) => (value) => onFieldChange("oauth2")({ ...config, [field]: value })
  const usesBrowser = config.grant === GRANT_AUTHORIZATION_CODE
  const callback = actions.oauthCallback

  return (
    <>
      <Field label="Grant type">
        <Select value={config.grant} onChange={(event) => onConfigChange("grant")(event.target.value)}>
          {GRANTS.map((grant) => (
            <option key={grant.value} value={grant.value}>{grant.label}</option>
          ))}
        </Select>
      </Field>
      {usesBrowser && (
        <>
          <Field label="Authorization URL">
            <TextInput value={config.authUrl} onChange={onConfigChange("authUrl")} placeholder="https://provider.example.com/authorize" />
          </Field>
          <Field label="Callback URL">
            <TextInput
              value={callback.isFixed ? callback.url : config.callbackUrl}
              onChange={onConfigChange("callbackUrl")}
              placeholder={callback.url}
              readOnly={callback.isFixed}
              title={`Register ${callbackUrlFor(callback, config)} as a redirect URI with the provider`}
            />
          </Field>
        </>
      )}
      <Field label="Token URL">
        <TextInput value={config.tokenUrl} onChange={onConfigChange("tokenUrl")} placeholder="https://provider.example.com/token" />
      </Field>
      <Field label="Client ID">
        <TextInput value={config.clientId} onChange={onConfigChange("clientId")} />
      </Field>
      <Field label="Client secret">
        <SecretInput value={config.clientSecret} onChange={onConfigChange("clientSecret")} />
      </Field>
      {config.grant === GRANT_PASSWORD && (
        <>
          <Field label="Username">
            <TextInput value={config.username} onChange={onConfigChange("username")} />
          </Field>
          <Field label="Password">
            <SecretInput value={config.password} onChange={onConfigChange("password")} />
          </Field>
        </>
      )}
      <Field label="Scope">
        <TextInput value={config.scope} onChange={onConfigChange("scope")} placeholder="read write" />
      </Field>
      <Field label="Send credentials in">
        <Select
          value={config.credentialsIn || CREDENTIALS_IN_HEADER}
          onChange={(event) => onConfigChange("credentialsIn")(event.target.value)}
        >
          <option value={CREDENTIALS_IN_HEADER}>Basic auth header</option>
          <option value={CREDENTIALS_IN_BODY}>Request body</option>
        </Select>
      </Field>
      {usesBrowser && (
        <Checkbox
          checked={config.pkce}
          onChange={(event) => onConfigChange("pkce")(event.target.checked)}
          className="h-7 justify-start self-start"
        >
          Use PKCE
        </Checkbox>
      )}
      <Field label="Header prefix">
        <TextInput value={config.headerPrefix} onChange={onConfigChange("headerPrefix")} placeholder="Bearer" />
      </Field>
      <Field label="Access token">
        <SecretInput value={config.accessToken} onChange={onConfigChange("accessToken")} />
      </Field>
      <TokenControls config={config} tokenRequest={tokenRequest} actions={actions} onClear={actions.forgetToken} />
    </>
  )
}
