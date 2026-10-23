import {
  DeleteSecretConnection,
  PairSecretConnection,
  ResolveSecretReferences,
  SaveSecretConnection,
  SecretConnections,
  SecretKinds,
  TestSecretReference,
} from '../../../wailsjs/go/main/App'

const listeners = new Set()

const failing = (call) => async (...args) => {
  try {
    return await call(...args)
  } catch (error) {
    throw new Error(error?.message || String(error))
  }
}

const announcing = (call) => async (...args) => {
  const result = await call(...args)
  listeners.forEach((listener) => listener())
  return result
}

export const desktopSecrets = {
  kinds: failing(() => SecretKinds()),
  connections: failing(() => SecretConnections()),
  save: announcing(failing((connection) => SaveSecretConnection(connection))),
  remove: announcing(failing((alias) => DeleteSecretConnection(alias))),
  pair: failing((kind) => PairSecretConnection(kind)),
  test: failing((reference) => TestSecretReference(reference)),
  resolve: failing((references) => ResolveSecretReferences(references)),
  subscribe: (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
