import { filterJson } from './responseSearch'

const PRETTY_INDENT = 2

let parsedText = null
let parsedValue

function parse(text) {
  if (text !== parsedText) {
    parsedValue = JSON.parse(text)
    parsedText = text
  }
  return parsedValue
}

const TASKS = {
  format: ({ text }) => ({ text: JSON.stringify(parse(text), null, PRETTY_INDENT) }),
  filter: ({ text, path, withValue }) => {
    const { value, ...result } = filterJson(parse(text), path)
    return withValue ? { ...result, value } : result
  },
}

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ id: data.id, ...TASKS[data.task](data) })
  } catch (error) {
    self.postMessage({ id: data.id, failure: error.message })
  }
}
