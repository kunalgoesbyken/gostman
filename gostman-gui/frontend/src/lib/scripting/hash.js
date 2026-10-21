const MD5_CONSTANTS = 'd76aa478e8c7b756242070dbc1bdceeef57c0faf4787c62aa8304613fd469501698098d88b44f7afffff5bb1895cd7be6b901122fd987193a679438e49b40821f61e2562c040b340265e5a51e9b6c7aad62f105d02441453d8a1e681e7d3fbc821e1cde6c33707d6f4d50d87455a14eda9e3e905fcefa3f8676f02d98d2a4c8afffa39428771f6816d9d6122fde5380ca4beea444bdecfa9f6bb4b60bebfbc70289b7ec6eaa127fad4ef308504881d05d9d4d039e6db99e51fa27cf8c4ac5665f4292244432aff97ab9423a7fc93a039655b59c38f0ccc92ffeff47d85845dd16fa87e4ffe2ce6e0a30143144e0811a1f7537e82bd3af2352ad7d2bbeb86d391'
const SHA512_CONSTANTS = '428a2f98d728ae227137449123ef65cdb5c0fbcfec4d3b2fe9b5dba58189dbbc3956c25bf348b53859f111f1b605d019923f82a4af194f9bab1c5ed5da6d8118d807aa98a303024212835b0145706fbe243185be4ee4b28c550c7dc3d5ffb4e272be5d74f27b896f80deb1fe3b1696b19bdc06a725c71235c19bf174cf692694e49b69c19ef14ad2efbe4786384f25e30fc19dc68b8cd5b5240ca1cc77ac9c652de92c6f592b02754a7484aa6ea6e4835cb0a9dcbd41fbd476f988da831153b5983e5152ee66dfaba831c66d2db43210b00327c898fb213fbf597fc7beef0ee4c6e00bf33da88fc2d5a79147930aa72506ca6351e003826f142929670a0e6e7027b70a8546d22ffc2e1b21385c26c9264d2c6dfc5ac42aed53380d139d95b3df650a73548baf63de766a0abb3c77b2a881c2c92e47edaee692722c851482353ba2bfe8a14cf10364a81a664bbc423001c24b8b70d0f89791c76c51a30654be30d192e819d6ef5218d69906245565a910f40e35855771202a106aa07032bbd1b819a4c116b8d2d0c81e376c085141ab532748774cdf8eeb9934b0bcb5e19b48a8391c0cb3c5c95a634ed8aa4ae3418acb5b9cca4f7763e373682e6ff3d6b2b8a3748f82ee5defb2fc78a5636f43172f6084c87814a1f0ab728cc702081a6439ec90befffa23631e28a4506cebde82bde9bef9a3f7b2c67915c67178f2e372532bca273eceea26619cd186b8c721c0c207eada7dd6cde0eb1ef57d4f7fee6ed17806f067aa72176fba0a637dc5a2c898a6113f9804bef90dae1b710b35131c471b28db77f523047d8432caab7b40c724933c9ebe0a15c9bebc431d67c49c100d4c4cc5d4becb3e42b6597f299cfc657e2a5fcb6fab3ad6faec6c44198c4a475817'
const SHA512_INITIAL = '6a09e667f3bcc908bb67ae8584caa73b3c6ef372fe94f82ba54ff53a5f1d36f1510e527fade682d19b05688c2b3e6c1f1f83d9abfb41bd6b5be0cd19137e2179'
const SHA1_INITIAL = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]
const MD5_INITIAL = SHA1_INITIAL.slice(0, 4)
const MD5_SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]
const BLOCK_BYTES = 64
const WIDE_BLOCK_BYTES = 128
const HEX_PAIR = 8
const WORD_HEX = 8

const hexWords = (text, size) => Array.from({ length: text.length / size }, (_, index) => text.slice(index * size, (index + 1) * size))

const MD5_K = hexWords(MD5_CONSTANTS, WORD_HEX).map((word) => parseInt(word, 16))
const SHA512_K = hexWords(SHA512_CONSTANTS, WORD_HEX * 2).map((word) => [parseInt(word.slice(0, HEX_PAIR), 16), parseInt(word.slice(HEX_PAIR), 16)])
const SHA256_K = SHA512_K.slice(0, 64).map(([high]) => high)
const SHA256_INITIAL = hexWords(SHA512_INITIAL, WORD_HEX * 2).map((word) => parseInt(word.slice(0, HEX_PAIR), 16))
const SHA512_H = hexWords(SHA512_INITIAL, WORD_HEX * 2).map((word) => [parseInt(word.slice(0, HEX_PAIR), 16), parseInt(word.slice(HEX_PAIR), 16)])

const rotateLeft = (value, count) => (value << count) | (value >>> (32 - count))
const rotateRight = (value, count) => (value >>> count) | (value << (32 - count))

function pad(bytes, blockSize, littleEndian) {
  const total = Math.ceil((bytes.length + 1 + blockSize / 8) / blockSize) * blockSize
  const padded = new Uint8Array(total)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  const bits = bytes.length * 8
  view.setUint32(total - 8, littleEndian ? bits >>> 0 : Math.floor(bits / 2 ** 32), littleEndian)
  view.setUint32(total - 4, littleEndian ? Math.floor(bits / 2 ** 32) : bits >>> 0, littleEndian)
  return { view, total }
}

function wordsToBytes(words, littleEndian) {
  const view = new DataView(new ArrayBuffer(words.length * 4))
  words.forEach((word, index) => view.setUint32(index * 4, word >>> 0, littleEndian))
  return new Uint8Array(view.buffer)
}

function md5(bytes) {
  const { view, total } = pad(bytes, BLOCK_BYTES, true)
  const state = [...MD5_INITIAL]
  for (let offset = 0; offset < total; offset += BLOCK_BYTES) {
    let [a, b, c, d] = state
    for (let round = 0; round < 64; round += 1) {
      const stage = round >> 4
      const mixed = [(b & c) | (~b & d), (d & b) | (~d & c), b ^ c ^ d, c ^ (b | ~d)][stage]
      const index = [round, (5 * round + 1) % 16, (3 * round + 5) % 16, (7 * round) % 16][stage]
      const sum = (a + mixed + MD5_K[round] + view.getUint32(offset + index * 4, true)) | 0
      a = d
      d = c
      c = b
      b = (b + rotateLeft(sum, MD5_SHIFTS[stage * 4 + (round % 4)])) | 0
    }
    state.forEach((word, index) => { state[index] = (word + [a, b, c, d][index]) | 0 })
  }
  return wordsToBytes(state, true)
}

function sha1(bytes) {
  const { view, total } = pad(bytes, BLOCK_BYTES, false)
  const state = [...SHA1_INITIAL]
  const schedule = new Array(80)
  for (let offset = 0; offset < total; offset += BLOCK_BYTES) {
    for (let index = 0; index < 80; index += 1) {
      schedule[index] = index < 16
        ? view.getUint32(offset + index * 4)
        : rotateLeft(schedule[index - 3] ^ schedule[index - 8] ^ schedule[index - 14] ^ schedule[index - 16], 1)
    }
    let [a, b, c, d, e] = state
    for (let index = 0; index < 80; index += 1) {
      const stage = Math.floor(index / 20)
      const mixed = [(b & c) | (~b & d), b ^ c ^ d, (b & c) | (b & d) | (c & d), b ^ c ^ d][stage]
      const constant = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6][stage]
      const next = (rotateLeft(a, 5) + mixed + e + constant + schedule[index]) | 0
      e = d
      d = c
      c = rotateLeft(b, 30)
      b = a
      a = next
    }
    state.forEach((word, index) => { state[index] = (word + [a, b, c, d, e][index]) | 0 })
  }
  return wordsToBytes(state, false)
}

function sha256(bytes) {
  const { view, total } = pad(bytes, BLOCK_BYTES, false)
  const state = [...SHA256_INITIAL]
  const schedule = new Array(64)
  for (let offset = 0; offset < total; offset += BLOCK_BYTES) {
    for (let index = 0; index < 64; index += 1) {
      if (index < 16) {
        schedule[index] = view.getUint32(offset + index * 4)
      } else {
        const low = rotateRight(schedule[index - 15], 7) ^ rotateRight(schedule[index - 15], 18) ^ (schedule[index - 15] >>> 3)
        const high = rotateRight(schedule[index - 2], 17) ^ rotateRight(schedule[index - 2], 19) ^ (schedule[index - 2] >>> 10)
        schedule[index] = (schedule[index - 16] + low + schedule[index - 7] + high) | 0
      }
    }
    let [a, b, c, d, e, f, g, h] = state
    for (let index = 0; index < 64; index += 1) {
      const sigmaE = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const first = (h + sigmaE + choice + SHA256_K[index] + schedule[index]) | 0
      const sigmaA = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      h = g
      g = f
      f = e
      e = (d + first) | 0
      d = c
      c = b
      b = a
      a = (first + sigmaA + majority) | 0
    }
    state.forEach((word, index) => { state[index] = (word + [a, b, c, d, e, f, g, h][index]) | 0 })
  }
  return wordsToBytes(state, false)
}

const add64 = (...terms) => {
  const low = terms.reduce((sum, term) => sum + term[1], 0)
  const high = terms.reduce((sum, term) => sum + term[0], 0) + Math.floor(low / 2 ** 32)
  return [high >>> 0, low >>> 0]
}

const xor64 = (...terms) => [terms.reduce((value, term) => value ^ term[0], 0) >>> 0, terms.reduce((value, term) => value ^ term[1], 0) >>> 0]

const and64 = (first, second) => [(first[0] & second[0]) >>> 0, (first[1] & second[1]) >>> 0]

const not64 = (value) => [~value[0] >>> 0, ~value[1] >>> 0]

function rotateRight64([high, low], count) {
  if (count >= 32) return rotateRight64([low, high], count - 32)
  if (count === 0) return [high, low]
  return [((high >>> count) | (low << (32 - count))) >>> 0, ((low >>> count) | (high << (32 - count))) >>> 0]
}

const shiftRight64 = ([high, low], count) => [high >>> count, ((low >>> count) | (high << (32 - count))) >>> 0]

function sha512(bytes) {
  const { view, total } = pad(bytes, WIDE_BLOCK_BYTES, false)
  const state = SHA512_H.map((word) => [...word])
  const schedule = new Array(80)
  for (let offset = 0; offset < total; offset += WIDE_BLOCK_BYTES) {
    for (let index = 0; index < 80; index += 1) {
      if (index < 16) {
        schedule[index] = [view.getUint32(offset + index * 8), view.getUint32(offset + index * 8 + 4)]
      } else {
        const older = schedule[index - 15]
        const newer = schedule[index - 2]
        const low = xor64(rotateRight64(older, 1), rotateRight64(older, 8), shiftRight64(older, 7))
        const high = xor64(rotateRight64(newer, 19), rotateRight64(newer, 61), shiftRight64(newer, 6))
        schedule[index] = add64(schedule[index - 16], low, schedule[index - 7], high)
      }
    }
    let [a, b, c, d, e, f, g, h] = state
    for (let index = 0; index < 80; index += 1) {
      const sigmaE = xor64(rotateRight64(e, 14), rotateRight64(e, 18), rotateRight64(e, 41))
      const choice = xor64(and64(e, f), and64(not64(e), g))
      const first = add64(h, sigmaE, choice, SHA512_K[index], schedule[index])
      const sigmaA = xor64(rotateRight64(a, 28), rotateRight64(a, 34), rotateRight64(a, 39))
      const majority = xor64(and64(a, b), and64(a, c), and64(b, c))
      h = g
      g = f
      f = e
      e = add64(d, first)
      d = c
      c = b
      b = a
      a = add64(first, sigmaA, majority)
    }
    const working = [a, b, c, d, e, f, g, h]
    state.forEach((word, index) => { state[index] = add64(word, working[index]) })
  }
  return wordsToBytes(state.flat(), false)
}

const ALGORITHMS = {
  md5: { digest: md5, blockBytes: BLOCK_BYTES },
  sha1: { digest: sha1, blockBytes: BLOCK_BYTES },
  sha256: { digest: sha256, blockBytes: BLOCK_BYTES },
  sha512: { digest: sha512, blockBytes: WIDE_BLOCK_BYTES },
}

export const HASH_ALGORITHMS = Object.keys(ALGORITHMS)

function algorithmOf(name) {
  const algorithm = ALGORITHMS[String(name).toLowerCase().replace('-', '')]
  if (!algorithm) throw new Error(`Unknown hash algorithm "${name}". Use ${HASH_ALGORITHMS.join(', ')}.`)
  return algorithm
}

export const digest = (name, bytes) => algorithmOf(name).digest(bytes)

export function hmac(name, keyBytes, messageBytes) {
  const { digest: hash, blockBytes } = algorithmOf(name)
  const key = new Uint8Array(blockBytes)
  key.set(keyBytes.length > blockBytes ? hash(keyBytes) : keyBytes)
  const outer = key.map((byte) => byte ^ 0x5c)
  const inner = key.map((byte) => byte ^ 0x36)
  return hash(Uint8Array.from([...outer, ...hash(Uint8Array.from([...inner, ...messageBytes]))]))
}
