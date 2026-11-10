const NIL = '00000000-0000-0000-0000-000000000000'
const PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const version = (id) => (PATTERN.test(String(id)) ? Number.parseInt(String(id)[14], 16) : undefined)

const STAMP_DIGITS = 12
const STAMP_FIRST_GROUP = 8
const RANDOM_START = 15

export function createUuid() {
  const v4 = () => crypto.randomUUID()
  const v7 = () => {
    const stamp = Date.now().toString(16).padStart(STAMP_DIGITS, '0')
    return `${stamp.slice(0, STAMP_FIRST_GROUP)}-${stamp.slice(STAMP_FIRST_GROUP)}-7${v4().slice(RANDOM_START)}`
  }
  return {
    v4,
    v7,
    NIL,
    validate: (id) => id === NIL || PATTERN.test(String(id)),
    version: (id) => (id === NIL ? 0 : version(id)),
  }
}
