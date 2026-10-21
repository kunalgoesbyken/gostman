# Themes, preferences and keyboard shortcuts

## Themes

- Colours are semantic HSL tokens in `gostman-gui/frontend/src/index.css`: `:root` is the light theme, `.dark` redefines every token for the dark theme. Components use only the Tailwind token classes (`bg-background`, `text-muted-foreground`, `text-success`, ...). Do not add literal colours to components. The landing page wraps itself in `.dark` and keeps its own look.
- Preference `theme` is `system`, `light` or `dark`. `system` follows `prefers-color-scheme` live. The resolved theme is the `dark` class on `<html>`.
- `public/theme-boot.js` is a blocking script in both HTML entries. It reads the stored preference and sets the class before the first paint, so neither the web page nor the desktop webview flashes the wrong theme.
- The desktop window background and frame follow the theme through `gostman-gui/window_theme.go`. The frontend reports the resolved theme with `SaveWindowTheme`; Go stores it next to `gostman.json` and `main.go` uses it for `BackgroundColour` and the Windows frame at the next start. The RGB values there must match `--background` in `index.css`.
- `prefers-contrast: more` raises the muted text, border and focus ring tokens in both themes. `forced-colors` marks selected controls with the system highlight. `prefers-reduced-motion` removes transitions and animations.
- Monaco reads the tokens at runtime (`MonacoEditor.jsx`), so it follows the theme and the contrast media query without a second palette.
- `src/lib/theme.test.mjs` parses `index.css` and fails when a text token pair drops below WCAG AA (4.5:1), or the focus ring below 3:1, in any of the four variants (light, dark, and both with more contrast).

## Preferences

`src/lib/preferences.js` holds one object, stored as JSON under `gostman.preferences` in `localStorage` (web and desktop webview) with a `version` field. Unknown fields, wrong types, out of range numbers and malformed JSON fall back per field to the defaults. All user visible strings are in `src/lib/preferencesText.js`; `language` currently offers one entry and sets `lang` and `dir` on `<html>`.

The default request timeout applies in the two backend adapters to requests that carry no timeout of their own.

## Keyboard shortcuts

`src/lib/shortcuts.js` stays the single table of actions and default chords. User overrides live in the preferences object (`shortcuts`): an action id maps to a chord, or to `null` for "no shortcut"; an absent id keeps the default. The effective binding is the override if present, else the default (the browser variant on the web).

### Matching

A chord is modifiers plus either `key` or `code`.

- Letters match `event.key` when it is a Latin letter, so AZERTY and QWERTZ users press the letter printed on the keycap.
- When `event.key` is not a Latin letter (Cyrillic, Arabic, Greek and other layouts, macOS Option combinations, dead keys) a letter chord falls back to the physical key (`event.code`, for example `KeyS`). Default shortcuts therefore work on every layout.
- Digits are stored as `code` (`Digit1`), because AZERTY needs Shift for digits. "Go to tab 1 to 9" is one binding: the modifiers are rebindable, the digits are fixed.
- Symbol chords such as `Ctrl+/` ignore Shift when the chord does not ask for it, because many layouts type those symbols with Shift.
- `mod` means Command on macOS and Ctrl elsewhere; `ctrl` means the Control key itself.
- Events during IME composition (`isComposing`, key code 229) never match.
- Matching reads modifier state from each event, never from earlier key events, so a modifier released outside the window cannot stick.

### Capture rules

The editor in the shortcuts dialog refuses, with a reason: a chord without Ctrl, Alt or the command key (function keys may stand alone); Ctrl together with Alt on non macOS systems, which is AltGr on many keyboards; the Windows or Super key; the text editing chords (copy, paste, cut, select all, undo, redo); on the web the chords browsers keep for themselves (new and close tab or window, reopen tab, tab switching with Ctrl+Tab, Ctrl+digit and Ctrl+Page Up/Down, quit); on macOS the system chords for quit, hide, minimise and Spotlight. A chord already used by another action shows who owns it and offers Replace, which leaves that action without a shortcut. Escape cancels capture. Window blur cancels capture.

### Known limits

- The same physical key combination may type a different character on some layouts; symbol chords are matched by the printed character. A user can rebind any action to something that suits the layout.
- Key labels for physical-key chords use the US names for symbol keys.
- The WebSocket composer keeps its own fixed `Ctrl+Enter`.
