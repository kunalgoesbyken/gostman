import { useSyncExternalStore } from "react"
import { Monitor, Moon, Sun } from "../landing/icons"
import { DOCS_TEXT } from "../../lib/docsText"
import { THEME_CHOICES, readTheme, serverTheme, subscribeTheme, writeTheme } from "../../docs/theme"

const ICONS = { system: Monitor, light: Sun, dark: Moon }

export function DocsThemeSwitch({ name }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme)

  return (
    <fieldset className="flex items-center justify-between gap-3">
      <legend className="float-left text-xs text-muted-foreground">{DOCS_TEXT.theme.label}</legend>
      <div className="flex rounded-md border border-border p-0.5">
        {THEME_CHOICES.map((choice) => {
          const Icon = ICONS[choice]
          return (
            <label key={choice} title={DOCS_TEXT.theme[choice]} className="relative">
              <input
                type="radio"
                name={name}
                value={choice}
                checked={theme === choice}
                onChange={() => writeTheme(choice)}
                className="peer sr-only"
              />
              <span className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground peer-checked:bg-muted peer-checked:text-foreground peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                <Icon className="h-4 w-4" />
              </span>
              <span className="sr-only">{DOCS_TEXT.theme[choice]}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
