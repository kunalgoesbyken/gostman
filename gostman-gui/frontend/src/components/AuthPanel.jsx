import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { IconButton } from "./ui/button"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { PanelBody } from "./ui/panel"
import { Select } from "./ui/select"
import { lookup } from "../lib/dataUtils"

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

const FIELDS_BY_TYPE = {
  [AUTH_BASIC]: BasicFields,
  [AUTH_BEARER]: BearerFields,
  [AUTH_API_KEY]: ApiKeyFields,
}

export function AuthPanel({ auth, onChange }) {
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
        {TypeFields && <TypeFields auth={auth} onFieldChange={onFieldChange} />}
        <p className="pt-1 text-xs text-muted-foreground">
          {TypeFields
            ? "Values can use {{variables}}. This overrides a header or parameter of the same name."
            : "This request is sent without authentication."}
        </p>
      </div>
    </PanelBody>
  )
}
