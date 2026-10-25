import { Field } from "./ui/field"
import { PanelBody } from "./ui/panel"
import { Select } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { SecretInput, TextInput } from "./AuthInputs"
import { OAuthFields } from "./OAuthFields"
import { lookup } from "../lib/dataUtils"
import { FOLDER_SETTINGS_TEXT as TEXT } from "../lib/folderSettingsText"
import { AUTH_INHERIT } from "../lib/inheritance"
import { AUTH_OAUTH2 } from "../lib/request"
import { FIELD_AREA, FIELD_SECRET, FIELD_SELECT, SCHEMES } from "../lib/authSchemes"
import { AUTH_TEXT } from "../lib/authText"
import { AUTH_API_KEY, AUTH_BASIC, AUTH_BEARER, AUTH_METHODS, AUTH_NONE } from "../lib/authTypes"

const IN_HEADER = "header"
const IN_QUERY = "query"

const INHERIT_TYPE = { value: AUTH_INHERIT, label: TEXT.inherit }

const AUTH_TYPES = [{ value: AUTH_NONE, label: TEXT.noAuth }, ...AUTH_METHODS]

function BasicFields({ auth, onFieldChange }) {
  return (
    <>
      <Field label={AUTH_TEXT.username}>
        <TextInput value={auth.username} onChange={onFieldChange("username")} />
      </Field>
      <Field label={AUTH_TEXT.password}>
        <SecretInput value={auth.password} onChange={onFieldChange("password")} />
      </Field>
    </>
  )
}

function BearerFields({ auth, onFieldChange }) {
  return (
    <Field label={AUTH_TEXT.token}>
      <SecretInput value={auth.token} onChange={onFieldChange("token")} />
    </Field>
  )
}

function ApiKeyFields({ auth, onFieldChange }) {
  return (
    <>
      <Field label={AUTH_TEXT.key}>
        <TextInput value={auth.key} onChange={onFieldChange("key")} placeholder={AUTH_TEXT.keyPlaceholder} />
      </Field>
      <Field label={AUTH_TEXT.value}>
        <SecretInput value={auth.value} onChange={onFieldChange("value")} />
      </Field>
      <Field label={AUTH_TEXT.addTo}>
        <Select value={auth.in || IN_HEADER} onChange={(event) => onFieldChange("in")(event.target.value)}>
          <option value={IN_HEADER}>{AUTH_TEXT.inHeader}</option>
          <option value={IN_QUERY}>{AUTH_TEXT.inQuery}</option>
        </Select>
      </Field>
    </>
  )
}

function SchemeInput({ field, value, onChange }) {
  if (field.kind === FIELD_SECRET) return <SecretInput value={value} onChange={onChange} />
  if (field.kind === FIELD_AREA) return <Textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
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

function typeOptions(inheritance) {
  if (!inheritance) return AUTH_TYPES
  const [noAuth, ...others] = AUTH_TYPES
  return [INHERIT_TYPE, { ...noAuth, value: inheritance.noAuthValue }, ...others]
}

function inheritedNote({ source, sourceType }) {
  if (!source) return TEXT.inheritsNothing
  const scheme = AUTH_METHODS.find((method) => method.value === sourceType)
  return scheme ? TEXT.inheritsSchemeFrom(source, scheme.label) : TEXT.inheritsFrom(source)
}

function authNote(auth, inheritance, hasFields) {
  if (inheritance && auth.type === AUTH_INHERIT) return inheritedNote(inheritance)
  if (hasFields) return AUTH_TEXT.fieldsNote
  return inheritance?.noAuthNote || AUTH_TEXT.noAuthNote
}

export function AuthPanel({ auth, tokenRequest, actions, inheritance, onChange }) {
  const onFieldChange = (field) => (value) => onChange({ ...auth, [field]: value })
  const scheme = lookup(SCHEMES, auth.type)
  const TypeFields = lookup(FIELDS_BY_TYPE, auth.type)

  return (
    <PanelBody className="h-full">
      <div className="flex max-w-xl flex-col gap-2">
        <Field label={AUTH_TEXT.type}>
          <Select value={auth.type} onChange={(event) => onFieldChange("type")(event.target.value)}>
            {typeOptions(inheritance).map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </Select>
        </Field>
        {TypeFields && <TypeFields auth={auth} onFieldChange={onFieldChange} tokenRequest={tokenRequest} actions={actions} />}
        {scheme && <SchemeFields scheme={scheme} auth={auth} onFieldChange={onFieldChange} />}
        <p className="pt-1 text-xs text-muted-foreground">
          {authNote(auth, inheritance, Boolean(TypeFields || scheme))}
        </p>
        {scheme?.note && <p className="text-xs text-muted-foreground">{scheme.note}</p>}
      </div>
    </PanelBody>
  )
}
