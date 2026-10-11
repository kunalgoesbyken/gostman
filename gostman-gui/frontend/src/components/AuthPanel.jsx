import { useState } from "react"
import { Eye, EyeOff, KeyRound, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { PanelBody } from "./ui/panel"
import { Select } from "./ui/select"
import { lookup } from "../lib/dataUtils"
import { GRANTS, GRANT_AUTHORIZATION_CODE, GRANT_PASSWORD, callbackUrlFor, hasToken, isTokenFresh } from "../lib/oauth"
import { AUTH_OAUTH2 } from "../lib/request"
import { cn } from "../lib/utils"

const AUTH_BASIC = "basic"
const AUTH_BEARER = "bearer"
const AUTH_API_KEY = "apikey"
const IN_HEADER = "header"
const IN_QUERY = "query"
const CREDENTIALS_IN_HEADER = "header"
const CREDENTIALS_IN_BODY = "body"

const AUTH_TYPES = [
  { value: "", label: "No auth" },
  { value: AUTH_BASIC, label: "Basic" },
  { value: AUTH_BEARER, label: "Bearer token" },
  { value: AUTH_API_KEY, label: "API key" },
  { value: AUTH_OAUTH2, label: "OAuth 2.0" },
]

function TextInput({ value, onChange, ...props }) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      autoComplete="off"
      className="font-mono"
      {...props}
    />
  )
}

function SecretInput({ value, onChange }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="relative min-w-0">
      <TextInput type={revealed ? "text" : "password"} value={value} onChange={onChange} className="pr-8 font-mono" />
      <IconButton
        label={revealed ? "Hide value" : "Show value"}
        icon={revealed ? EyeOff : Eye}
        size="icon-xs"
        onClick={() => setRevealed(!revealed)}
        className="absolute right-0.5 top-0.5"
      />
    </div>
  )
}

function BasicFields({ auth, onFieldChange }) {
  return (
    <>
      <Field label="Username">
        <TextInput value={auth.username} onChange={onFieldChange("username")} />
      </Field>
      <Field label="Password">
        <SecretInput value={auth.password} onChange={onFieldChange("password")} />
      </Field>
    </>
  )
}

function BearerFields({ auth, onFieldChange }) {
  return (
    <Field label="Token">
      <SecretInput value={auth.token} onChange={onFieldChange("token")} />
    </Field>
  )
}

function ApiKeyFields({ auth, onFieldChange }) {
  return (
    <>
      <Field label="Key">
        <TextInput value={auth.key} onChange={onFieldChange("key")} placeholder="X-API-Key" />
      </Field>
      <Field label="Value">
        <SecretInput value={auth.value} onChange={onFieldChange("value")} />
      </Field>
      <Field label="Add to">
        <Select value={auth.in || IN_HEADER} onChange={(event) => onFieldChange("in")(event.target.value)}>
          <option value={IN_HEADER}>Header</option>
          <option value={IN_QUERY}>Query params</option>
        </Select>
      </Field>
    </>
  )
}

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

function OAuthFields({ auth, onFieldChange, tokenRequest, actions }) {
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

const FIELDS_BY_TYPE = {
  [AUTH_BASIC]: BasicFields,
  [AUTH_BEARER]: BearerFields,
  [AUTH_API_KEY]: ApiKeyFields,
  [AUTH_OAUTH2]: OAuthFields,
}

export function AuthPanel({ auth, tokenRequest, actions, onChange }) {
  const onFieldChange = (field) => (value) => onChange({ ...auth, [field]: value })
  const TypeFields = lookup(FIELDS_BY_TYPE, auth.type)

  return (
    <PanelBody className="h-full">
      <div className="flex max-w-xl flex-col gap-2">
        <Field label="Type">
          <Select value={auth.type} onChange={(event) => onFieldChange("type")(event.target.value)}>
            {AUTH_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </Select>
        </Field>
        {TypeFields && <TypeFields auth={auth} onFieldChange={onFieldChange} tokenRequest={tokenRequest} actions={actions} />}
        <p className="pt-1 text-xs text-muted-foreground">
          {TypeFields
            ? "Values can use {{variables}}. This overrides a header or parameter of the same name."
            : "This request is sent without authentication."}
        </p>
      </div>
    </PanelBody>
  )
}
