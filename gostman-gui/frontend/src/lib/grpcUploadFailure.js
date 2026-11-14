import { formatBytes } from './byteSize'
import { FOLDER_SETTINGS_TEXT as TEXT } from './folderSettingsText'
import { MAX_UPLOADED_PROTO_FILES, maxUploadedProtoBytes } from './grpcUploads'

export function uploadFailureText(kind) {
  if (kind === 'empty') return TEXT.uploadEmpty
  if (kind === 'paths') return TEXT.uploadPaths
  if (kind === 'limit') return TEXT.uploadLimit(MAX_UPLOADED_PROTO_FILES, formatBytes(maxUploadedProtoBytes()))
  return TEXT.uploadFailed
}
