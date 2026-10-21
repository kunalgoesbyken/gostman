const NIL = '00000000-0000-0000-0000-000000000000'
const PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const version = (id) => (PATTERN.test(String(id)) ? Number.parseInt(String(id)[14], 16) : undefined)

export function createUuid() {
  const v4 = () => crypto.randomUUID()
  return {
    v4,
    NIL,
    validate: (id) => id === NIL || PATTERN.test(String(id)),
    version: (id) => (id === NIL ? 0 : version(id)),
  }
}
