import { ENGINE_PLACEHOLDER } from './variables'

export function isVariableName(name) {
  const placeholder = `{{${name}}}`
  return name === name.trim() && placeholder.match(ENGINE_PLACEHOLDER)?.[0] === placeholder
}
