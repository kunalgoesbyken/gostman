export const linkedFolderId = ({ specLinks, folders }, specId) => (
  Object.keys(specLinks).find((folderId) => specLinks[folderId].specId === specId && folders.some((folder) => folder.id === folderId))
)
