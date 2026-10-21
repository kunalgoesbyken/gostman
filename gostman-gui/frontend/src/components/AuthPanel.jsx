import { Field } from "./ui/field"
import { PanelBody } from "./ui/panel"
import { Select } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { SecretInput, TextInput } from "./AuthInputs"
import { OAuthFields } from "./OAuthFields"
import { lookup } from "../lib/dataUtils"
import { AUTH_OAUTH2 } from "../lib/request"
import { FIELD_AREA, FIELD_SECRET, FIELD_SELECT, SCHEMES } from "../lib/authSchemes"

const AUTH_BASIC = "basic"
const AUTH_BEARER = "bearer"
const AUTH_API_KEY = "apikey"
const IN_HEADER = "header"
const IN_QUERY = "query"

const AUTH_TYPES = [
  { value: "", label: "No auth" },
  { value: AUTH_BASIC, label: "Basic" },
  { value: AUTH_BEARER, label: "Bearer token" },
  { value: AUTH_API_KEY, label: "API key" },
  { value: AUTH_OAUTH2, label: "OAuth 2.0" },
  ...Object.entries(SCHEMES).map(([value, scheme]) => ({ value, label: scheme.label })),
]

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

function SchemeInput({ field, value, onChange }) {
  if (field.kind === FIELD_SECRET) return <SecretInput value={value} onChange={onChange} />
  if (field.kind === FIELD_AREA) return <Textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} />
  if (field.kind === FIELD_SELECT) {
    return (
      <Select value={value || field.fallback} onChange={(event) => onChange(event.target.value)}>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    )
  }
  return <TextInput value={value} onChange={onChange} placeholder={field.placeholder} />
}

function SchemeFields({ scheme, auth, onFieldChange }) {
  const config = scheme.section ? auth[scheme.section] || {} : auth
  const onConfigChange = (key) => (value) => (
    scheme.section ? onFieldChange(scheme.section)({ ...config, [key]: value }) : onFieldChange(key)(value)
  )

  return scheme.fields.filter((field) => !field.when || field.when(config)).map((field) => (
    <Field key={field.key} label={field.label}>
      <SchemeInput field={field} value={config[field.key] || ""} onChange={onConfigChange(field.key)} />
    </Field>
  ))
}

const FIELDS_BY_TYPE = {
  [AUTH_BASIC]: BasicFields,
  [AUTH_BEARER]: BearerFields,
  [AUTH_API_KEY]: ApiKeyFields,
  [AUTH_OAUTH2]: OAuthFields,
}

export function AuthPanel({ auth, tokenRequest, actions, onChange }) {
  const onFieldChange = (field) => (value) => onChange({ ...auth, [field]: value })
  const scheme = lookup(SCHEMES, auth.type)
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
        {scheme && <SchemeFields scheme={scheme} auth={auth} onFieldChange={onFieldChange} />}
        <p className="pt-1 text-xs text-muted-foreground">
          {TypeFields || scheme
            ? "Values can use {{variables}}. This overrides a header or parameter of the same name."
            : "This request is sent without authentication."}
        </p>
        {scheme?.note && <p className="text-xs text-muted-foreground">{scheme.note}</p>}
      </div>
    </PanelBody>
  )
}
