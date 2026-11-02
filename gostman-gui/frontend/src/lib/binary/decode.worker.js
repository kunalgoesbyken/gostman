import { decodeToJson } from './codecs'

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ text: decodeToJson(data.format, data.bytes) })
  } catch (error) {
    self.postMessage({ failure: error.message })
  }
}
