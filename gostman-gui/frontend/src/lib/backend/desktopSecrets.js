import {
  DeleteSecretConnection,
  ResolveSecretReferences,
  SaveSecretConnection,
  SecretConnections,
  SecretKinds,
  TestSecretReference,
} from '../../../wailsjs/go/main/App'

const failing = (call) => async (...args) => {
  try {
    return await call(...args)
  } catch (error) {
    throw new Error(error?.message || String(error))
  }
}

export const desktopSecrets = {
  kinds: failing(() => SecretKinds()),
  connections: failing(() => SecretConnections()),
  save: failing((connection) => SaveSecretConnection(connection)),
  remove: failing((alias) => DeleteSecretConnection(alias)),
  test: failing((reference) => TestSecretReference(reference)),
  resolve: failing((references) => ResolveSecretReferences(references)),
}
