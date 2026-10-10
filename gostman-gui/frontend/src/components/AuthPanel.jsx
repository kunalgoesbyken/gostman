import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { Select } from "./ui/select"

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

const TEXT_INPUT = "font-mono text-xs"

function TextInput({ value, onChange, ...props }) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      autoComplete="off"
      className={TEXT_INPUT}
      {...props}
    />
  )
}

function SecretInput({ value, onChange }) {
  const [revealed, setRevealed] = useState(false)
  const Icon = revealed ? EyeOff : Eye

  return (
    <div className="relative">
      <Input
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoComplete="off"
        className={`${TEXT_INPUT} pr-9`}
      />
      <button
        type="button"
        onClick={() => setRevealed(!revealed)}
        aria-label={revealed ? "Hide value" : "Show value"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="h-4 w-4" />
      </button>
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
        <Select value={auth.in || IN_HEADER} onChange={(event) => onFieldChange("in")(event.target.value)} className="text-xs">
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
  const TypeFields = FIELDS_BY_TYPE[auth.type]

  return (
    <div className="h-full overflow-auto px-4 py-3 scrollbar-primary">
      <div className="flex max-w-xl flex-col gap-2">
        <Field label="Type">
          <Select value={auth.type} onChange={(event) => onFieldChange("type")(event.target.value)} className="text-xs">
            {AUTH_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </Select>
        </Field>
        {TypeFields && <TypeFields auth={auth} onFieldChange={onFieldChange} />}
        {TypeFields && (
          <p className="pt-1 text-xs text-muted-foreground">
            Values can use {"{{variables}}"}. This overrides a header or parameter of the same name.
          </p>
        )}
      </div>
    </div>
  )
}
