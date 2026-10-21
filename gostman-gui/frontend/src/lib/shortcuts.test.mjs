import assert from "node:assert/strict"
import { test } from "node:test"
import { chordFromEvent, chordLabel, chordSignature, sanitizeOverrides } from "./chords.js"
import { SHORTCUTS, activeShortcuts, bindingFor, checkChord, matchesBinding, shortcutRows, withChord, withoutChord } from "./shortcuts.js"
import { DEFAULT_PREFERENCES, normalizePreferences, resolveTheme } from "./preferences.js"

const press = (fields) => ({ key: "", code: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false, keyCode: 0, ...fields })
const shortcut = (id) => SHORTCUTS.find((candidate) => candidate.id === id)
const desktop = { isDesktop: true, isApple: false, overrides: {} }
const browser = { isDesktop: false, isApple: false, overrides: {} }
const mac = { isDesktop: true, isApple: true, overrides: {} }

test("default letter chords match the key that is printed on the keycap", () => {
  const palette = shortcut("commandPalette")
  assert.ok(matchesBinding(palette, press({ key: "k", code: "KeyK", ctrlKey: true }), false))
  assert.ok(matchesBinding(palette, press({ key: "K", code: "KeyK", ctrlKey: true }), false))
  assert.ok(!matchesBinding(palette, press({ key: "k", code: "KeyK" }), false))
  assert.ok(!matchesBinding(palette, press({ key: "k", code: "KeyK", ctrlKey: true, shiftKey: true }), false))
})

test("AZERTY and QWERTZ follow the printed letter, not the physical position", () => {
  const closeTab = shortcut("closeTab")
  assert.ok(matchesBinding(closeTab, press({ key: "w", code: "KeyZ", ctrlKey: true }), false))
  assert.ok(!matchesBinding(closeTab, press({ key: "z", code: "KeyW", ctrlKey: true }), false))
  const reopen = shortcut("reopenTab")
  assert.ok(matchesBinding(reopen, press({ key: "T", code: "KeyT", ctrlKey: true, shiftKey: true }), false))
})

test("Cyrillic, Arabic and Greek layouts fall back to the physical letter key", () => {
  const save = shortcut("saveRequest")
  assert.ok(matchesBinding(save, press({ key: "ы", code: "KeyS", ctrlKey: true }), false))
  assert.ok(matchesBinding(save, press({ key: "س", code: "KeyS", ctrlKey: true }), false))
  assert.ok(matchesBinding(save, press({ key: "σ", code: "KeyS", ctrlKey: true }), false))
  assert.ok(!matchesBinding(save, press({ key: "ы", code: "KeyD", ctrlKey: true }), false))
})

test("Option and dead keys on macOS still match by physical letter", () => {
  const sidebar = shortcut("toggleSidebar")
  assert.ok(matchesBinding(sidebar, press({ key: "b", code: "KeyB", metaKey: true }), true))
  assert.ok(!matchesBinding(sidebar, press({ key: "b", code: "KeyB", ctrlKey: true }), true))
  const withOption = { mod: true, alt: true, key: "a" }
  assert.ok(matchesBinding(withOption, press({ key: "å", code: "KeyA", metaKey: true, altKey: true }), true))
  assert.ok(matchesBinding(withOption, press({ key: "Dead", code: "KeyA", metaKey: true, altKey: true }), true))
})

test("symbol chords ignore the implicit Shift of layouts that type them with Shift", () => {
  const help = shortcut("shortcutsHelp")
  assert.ok(matchesBinding(help, press({ key: "/", code: "Slash", ctrlKey: true }), false))
  assert.ok(matchesBinding(help, press({ key: "/", code: "Digit7", ctrlKey: true, shiftKey: true }), false))
})

test("digit chords use the physical key so AZERTY needs no Shift", () => {
  const second = bindingFor(shortcut("tab2"), true, {})
  assert.ok(matchesBinding(second, press({ key: "é", code: "Digit2", altKey: true }), false))
  assert.ok(!matchesBinding(second, press({ key: "2", code: "Digit3", altKey: true }), false))
})

test("IME composition never triggers a shortcut", () => {
  const send = shortcut("sendRequest")
  assert.ok(matchesBinding(send, press({ key: "Enter", code: "Enter", ctrlKey: true }), false))
  assert.ok(!matchesBinding(send, press({ key: "Enter", code: "Enter", ctrlKey: true, isComposing: true }), false))
  assert.ok(!matchesBinding(send, press({ key: "Process", code: "Enter", ctrlKey: true, keyCode: 229 }), false))
})

test("AltGr (Ctrl+Alt) does not trigger an Alt-only chord", () => {
  const second = bindingFor(shortcut("tab2"), true, {})
  assert.ok(!matchesBinding(second, press({ key: "@", code: "Digit2", altKey: true, ctrlKey: true }), false))
})

test("the browser build swaps reserved defaults for Alt chords", () => {
  assert.deepEqual(bindingFor(shortcut("closeTab"), false, {}), { id: "closeTab", alt: true, key: "w" })
  assert.equal(bindingFor(shortcut("closeTab"), true, {}), shortcut("closeTab"))
})

test("overrides replace defaults, null unbinds and absence keeps the default", () => {
  const overrides = { saveRequest: { mod: true, shift: true, key: "s" }, closeTab: null }
  assert.deepEqual(bindingFor(shortcut("saveRequest"), true, overrides), { id: "saveRequest", mod: true, shift: true, key: "s" })
  assert.equal(bindingFor(shortcut("closeTab"), true, overrides), null)
  assert.equal(bindingFor(shortcut("newRequest"), true, overrides), shortcut("newRequest"))
  const active = activeShortcuts(true, overrides).map((entry) => entry.shortcut.id)
  assert.ok(!active.includes("closeTab") && active.includes("saveRequest"))
})

test("rebinding the first tab moves all nine position shortcuts together", () => {
  const overrides = { tab1: { mod: true, code: "Digit1" } }
  const ninth = bindingFor(shortcut("tab9"), true, overrides)
  assert.deepEqual(ninth, { id: "tab9", mod: true, code: "Digit9" })
  const row = shortcutRows(overrides, true, false).find((candidate) => candidate.id === "tab1")
  assert.equal(row.keys, "Ctrl+1 to 9")
  assert.equal(row.isCustom, true)
})

test("an unbound action is listed with no keys and no conflict", () => {
  const row = shortcutRows({ closeTab: null }, true, false).find((candidate) => candidate.id === "closeTab")
  assert.equal(row.keys, "")
  assert.equal(row.binding, null)
})

test("the same chord on another action is reported as a conflict", () => {
  const result = checkChord("saveRequest", { mod: true, key: "k" }, desktop)
  assert.equal(result.conflict.id, "commandPalette")
  assert.equal(checkChord("saveRequest", { mod: true, key: "s" }, desktop).conflict, undefined)
})

test("a conflict is found whichever way the chord was captured", () => {
  const byCode = checkChord("saveRequest", { mod: true, code: "KeyK" }, desktop)
  assert.equal(byCode.conflict.id, "commandPalette")
  const bySymbol = checkChord("saveRequest", { mod: true, code: "Slash" }, desktop)
  assert.equal(bySymbol.conflict.id, "shortcutsHelp")
})

test("replacing a conflict unbinds the previous owner", () => {
  const conflict = checkChord("saveRequest", { mod: true, key: "k" }, desktop).conflict
  const replaced = withChord(withChord({}, conflict.id, null), "saveRequest", { mod: true, key: "k" })
  assert.equal(bindingFor(shortcut("commandPalette"), true, replaced), null)
  assert.equal(bindingFor(shortcut("saveRequest"), true, replaced).key, "k")
  assert.deepEqual(withoutChord(replaced, "commandPalette"), { saveRequest: { mod: true, key: "k" } })
})

test("position shortcuts must be a digit key and conflict as a group", () => {
  assert.equal(checkChord("tab1", { alt: true, key: "x" }, desktop).error, "needsDigit")
  assert.equal(checkChord("tab1", { mod: true, code: "Digit1" }, desktop).error, undefined)
  const clash = checkChord("tab1", { alt: true, code: "Digit1" }, { ...desktop, overrides: { closeTab: { alt: true, code: "Digit4" } } })
  assert.equal(clash.conflict.id, "closeTab")
})

test("editing, browser and system chords are refused with a reason", () => {
  assert.equal(checkChord("saveRequest", { mod: true, key: "c" }, desktop).error, "editing")
  assert.equal(checkChord("saveRequest", { mod: true, key: "w" }, browser).error, "browser")
  assert.equal(checkChord("saveRequest", { mod: true, key: "w" }, desktop).error, undefined)
  assert.equal(checkChord("saveRequest", { mod: true, key: "q" }, mac).error, "system")
  assert.equal(checkChord("tab1", { mod: true, code: "Digit1" }, browser).error, "browser")
  assert.equal(checkChord("nextTab", { ctrl: true, key: "tab" }, browser).error, "browser")
})

test("capture builds a chord from the layout the user is typing on", () => {
  assert.deepEqual(chordFromEvent(press({ key: "k", code: "KeyK", ctrlKey: true }), false), { chord: { mod: true, key: "k" } })
  assert.deepEqual(chordFromEvent(press({ key: "л", code: "KeyK", ctrlKey: true }), false), { chord: { mod: true, key: "k" } })
  assert.deepEqual(chordFromEvent(press({ key: "k", code: "KeyK", metaKey: true, ctrlKey: false }), true), { chord: { mod: true, key: "k" } })
  assert.deepEqual(chordFromEvent(press({ key: "k", code: "KeyK", ctrlKey: true }), true), { chord: { ctrl: true, key: "k" } })
  assert.deepEqual(chordFromEvent(press({ key: "&", code: "Digit1", altKey: true }), false), { chord: { alt: true, code: "Digit1" } })
  assert.deepEqual(chordFromEvent(press({ key: "Enter", code: "Enter", ctrlKey: true }), false), { chord: { mod: true, key: "enter" } })
  assert.deepEqual(chordFromEvent(press({ key: " ", code: "Space", altKey: true }), false), { chord: { alt: true, key: "space" } })
  assert.deepEqual(chordFromEvent(press({ key: "F5", code: "F5" }), false), { chord: { key: "f5" } })
})

test("capture waits on modifiers alone and rejects unusable combinations", () => {
  assert.deepEqual(chordFromEvent(press({ key: "Control", code: "ControlLeft", ctrlKey: true }), false), { modifiers: { mod: true } })
  assert.deepEqual(chordFromEvent(press({ key: "Shift", code: "ShiftLeft", shiftKey: true }), false), { modifiers: { shift: true } })
  assert.equal(chordFromEvent(press({ key: "k", code: "KeyK" }), false).error, "needsModifier")
  assert.equal(chordFromEvent(press({ key: "K", code: "KeyK", shiftKey: true }), false).error, "needsModifier")
  assert.equal(chordFromEvent(press({ key: "@", code: "Digit2", ctrlKey: true, altKey: true }), false).error, "altGraph")
  assert.equal(chordFromEvent(press({ key: "k", code: "KeyK", metaKey: true }), false).error, "metaUnsupported")
  assert.equal(chordFromEvent(press({ key: "k", code: "KeyK", metaKey: true, ctrlKey: true }), true).error, "ambiguousModifiers")
  assert.deepEqual(chordFromEvent(press({ key: "Process", code: "KeyK", ctrlKey: true, keyCode: 229 }), false), { modifiers: { mod: true } })
})

test("labels follow the platform", () => {
  const chord = { mod: true, shift: true, key: "t" }
  assert.equal(chordLabel(chord, false), "Ctrl+Shift+T")
  assert.equal(chordLabel(chord, true), "⌘⇧T")
  assert.equal(chordLabel({ ctrl: true, key: "tab" }, true), "⌃Tab")
  assert.equal(chordLabel({ alt: true, code: "BracketRight" }, false), "Alt+]")
  assert.equal(chordLabel({ alt: true, code: "Digit3" }, false), "Alt+3")
})

test("signatures treat the command key as Ctrl off macOS", () => {
  assert.equal(chordSignature({ mod: true, key: "k" }, false), chordSignature({ ctrl: true, key: "k" }, false))
  assert.notEqual(chordSignature({ mod: true, key: "k" }, true), chordSignature({ ctrl: true, key: "k" }, true))
})

test("stored preferences survive garbage, unknown fields and a newer version", () => {
  assert.deepEqual(normalizePreferences(null), DEFAULT_PREFERENCES)
  assert.deepEqual(normalizePreferences("dark"), DEFAULT_PREFERENCES)
  const messy = normalizePreferences({
    version: 99,
    theme: "neon",
    density: "compact",
    editorFontSize: 99,
    requestTimeoutSeconds: 30.5,
    wrapLines: "yes",
    confirmCloseTab: false,
    language: "xx",
    futureField: true,
    shortcuts: { saveRequest: { mod: true, key: "S" }, closeTab: null, bad: { key: 5 }, worse: 7, both: { key: "a", code: "KeyA" } },
  })
  assert.equal(messy.theme, "system")
  assert.equal(messy.density, "compact")
  assert.equal(messy.editorFontSize, 12)
  assert.equal(messy.requestTimeoutSeconds, 0)
  assert.equal(messy.wrapLines, true)
  assert.equal(messy.confirmCloseTab, false)
  assert.equal(messy.language, "en")
  assert.equal("futureField" in messy, false)
  assert.deepEqual(messy.shortcuts, { saveRequest: { mod: true, key: "s" }, closeTab: null })
  assert.deepEqual(sanitizeOverrides([]), {})
})

test("the system theme follows the operating system", () => {
  assert.equal(resolveTheme("system", true), "dark")
  assert.equal(resolveTheme("system", false), "light")
  assert.equal(resolveTheme("light", true), "light")
})
