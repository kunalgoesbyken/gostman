import { searchDocuments } from './globalSearch'

self.onmessage = ({ data }) => {
  try {
    self.postMessage(searchDocuments(data.documents, data.query))
  } catch (error) {
    self.postMessage({ failure: error.message })
  }
}
