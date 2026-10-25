import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

export const LOCALES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../locales')
export const REPOSITORY_ROOT = resolve(LOCALES_ROOT, '..')
