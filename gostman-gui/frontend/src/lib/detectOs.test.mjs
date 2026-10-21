import assert from "node:assert/strict"
import { test } from "node:test"
import { detectOs } from "./detectOs.js"

test("desktop platforms map to their installer", () => {
  assert.equal(detectOs({ platform: "macOS", userAgent: "Mozilla/5.0 (Macintosh)" }), "macos")
  assert.equal(detectOs({ platform: "Windows", userAgent: "Mozilla/5.0 (Windows NT 10.0)" }), "windows")
  assert.equal(detectOs({ platform: "Linux x86_64", userAgent: "Mozilla/5.0 (X11; Linux x86_64)" }), "linux")
})

test("phones and tablets have no desktop installer", () => {
  assert.equal(detectOs({ platform: "Linux armv81", userAgent: "Mozilla/5.0 (Linux; Android 14)" }), "other")
  assert.equal(detectOs({ platform: "iPhone", userAgent: "Mozilla/5.0 (iPhone)" }), "other")
  assert.equal(detectOs({ platform: "MacIntel", userAgent: "Mozilla/5.0 (Macintosh)", maxTouchPoints: 5 }), "other")
})

test("unknown input falls back to other", () => {
  assert.equal(detectOs(), "other")
})
