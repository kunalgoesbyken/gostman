import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { blend, contrastRatio, tripletToRgb } from "./colour.js"

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8")

const TEXT_MINIMUM = 4.5
const GRAPHIC_MINIMUM = 3
const TINT = 0.1

const balancedBlock = (source, opening) => {
  const start = source.indexOf(opening)
  assert.notEqual(start, -1, `${opening} is missing`)
  let depth = 0
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1
    if (source[index] === "}") depth -= 1
    if (depth === 0) return source.slice(source.indexOf("{", start) + 1, index)
  }
  throw new Error(`${opening} is not closed`)
}

const declarations = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value]))

const moreContrast = balancedBlock(css, "@media (prefers-contrast: more)")
const withoutMore = css.replace(moreContrast, "")

const LIGHT = declarations(balancedBlock(withoutMore, ":root {"))
const DARK = { ...LIGHT, ...declarations(balancedBlock(withoutMore, ".dark {")) }

const THEMES = {
  light: LIGHT,
  dark: DARK,
  "light, more contrast": { ...LIGHT, ...declarations(balancedBlock(moreContrast, ":root {")) },
  "dark, more contrast": { ...DARK, ...declarations(balancedBlock(moreContrast, ".dark {")) },
}

const SURFACES = ["background", "card", "muted", "secondary", "accent"]
const STATUS = ["destructive", "success", "warning", "info"]
const SYNTAX = ["key", "string", "number", "boolean", "null", "punctuation"]

const colour = (tokens, name) => tripletToRgb(tokens[name])

const textPairs = (tokens) => [
  ...SURFACES.flatMap((surface) => ["foreground", "muted-foreground"].map((text) => [text, surface, colour(tokens, text), colour(tokens, surface)])),
  ...["primary", ...STATUS].map((name) => [`${name}-foreground`, name, colour(tokens, `${name}-foreground`), colour(tokens, name)]),
  ...["primary", ...STATUS].map((name) => [name, "background", colour(tokens, name), colour(tokens, "background")]),
  ...["primary", ...STATUS].map((name) => [name, "card", colour(tokens, name), colour(tokens, "card")]),
  ...STATUS.map((name) => [`${name} on its ${TINT * 100}% tint`, "background", colour(tokens, name), blend(colour(tokens, name), colour(tokens, "background"), TINT)]),
  ...SYNTAX.map((name) => [`syntax-${name}`, "background", colour(tokens, `syntax-${name}`), colour(tokens, "background")]),
  ...SYNTAX.map((name) => [`syntax-${name}`, "card", colour(tokens, `syntax-${name}`), colour(tokens, "card")]),
]

const graphicPairs = (tokens) => [["ring", "background", colour(tokens, "ring"), colour(tokens, "background")]]

const borderPairs = (tokens) => [
  ["border", "background", colour(tokens, "border"), colour(tokens, "background")],
  ["input", "background", colour(tokens, "input"), colour(tokens, "background")],
]

const ratioOf = ([, , foreground, background]) => contrastRatio(foreground, background)

const describe = ([foreground, background, ...colours]) => `${foreground} on ${background}`

for (const [name, tokens] of Object.entries(THEMES)) {
  test(`${name}: text tokens reach WCAG AA`, (t) => {
    for (const pair of textPairs(tokens)) {
      t.diagnostic(`${name} | ${describe(pair)} | ${ratioOf(pair).toFixed(2)}`)
      assert.ok(ratioOf(pair) >= TEXT_MINIMUM, `${name}: ${describe(pair)} is ${ratioOf(pair).toFixed(2)}`)
    }
  })

  test(`${name}: focus ring reaches 3:1`, () => {
    for (const pair of graphicPairs(tokens)) assert.ok(ratioOf(pair) >= GRAPHIC_MINIMUM, `${name}: ${describe(pair)} is ${ratioOf(pair).toFixed(2)}`)
  })
}

for (const name of ["light, more contrast", "dark, more contrast"]) {
  test(`${name}: control borders reach 3:1`, () => {
    for (const pair of borderPairs(THEMES[name])) assert.ok(ratioOf(pair) >= GRAPHIC_MINIMUM, `${name}: ${describe(pair)} is ${ratioOf(pair).toFixed(2)}`)
  })
}
