import { readStored, writeStored } from './storage'

export const VIEW_TABLE = 'table'
export const VIEW_TEXT = 'text'

const VIEW_KEY = 'gostman.collectionVariablesView'

export const rememberedVariablesView = () => (readStored(VIEW_KEY) === VIEW_TEXT ? VIEW_TEXT : VIEW_TABLE)

export const rememberVariablesView = (view) => writeStored(VIEW_KEY, view)
