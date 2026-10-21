import assert from "node:assert/strict"
import { test } from "node:test"
import { base64ToBytes, bytesToBase64, bytesToHex, utf8Decode, utf8Encode } from "./encoding.js"
import { digest, hmac } from "./hash.js"

const hexOf = (algorithm, text) => bytesToHex(digest(algorithm, utf8Encode(text)))

test("digests of abc match the published vectors", () => {
  assert.equal(hexOf("md5", "abc"), "900150983cd24fb0d6963f7d28e17f72")
  assert.equal(hexOf("sha1", "abc"), "a9993e364706816aba3e25717850c26c9cd0d89d")
  assert.equal(hexOf("sha256", "abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  assert.equal(
    hexOf("sha512", "abc"),
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
  )
})

test("hmac matches RFC 4231 test cases 1 and 2", () => {
  const first = hmac("sha256", new Uint8Array(20).fill(0x0b), utf8Encode("Hi There"))
  assert.equal(bytesToHex(first), "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7")
  const second = hmac("sha256", utf8Encode("Jefe"), utf8Encode("what do ya want for nothing?"))
  assert.equal(bytesToHex(second), "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843")
})

test("base64 and utf-8 round trip Unicode", () => {
  const text = "héllo 世界 😀"
  assert.equal(bytesToBase64(utf8Encode(text)), "aMOpbGxvIOS4lueVjCDwn5iA")
  assert.equal(utf8Decode(base64ToBytes("aMOpbGxvIOS4lueVjCDwn5iA")), text)
})

test("unknown algorithms are rejected", () => {
  assert.throws(() => digest("crc32", new Uint8Array()), /Unknown hash algorithm/)
})
