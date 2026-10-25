const MAX_REMEMBERED = 500
const remembered = new Set()

export function rememberResolved(values) {
  for (const value of Object.values(values || {})) {
    if (typeof value !== 'string' || value === '') continue
    remembered.delete(value)
    remembered.add(value)
    if (remembered.size > MAX_REMEMBERED) remembered.delete(remembered.values().next().value)
  }
}

export const resolvedSecretValues = () => [...remembered]
