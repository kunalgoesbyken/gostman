import { useMemo } from 'react'
import { offeredEnvironments } from '../lib/environmentScope'
import { findActiveEnvironment, selectActiveTab, useAppStore } from '../store/appStore'

export function useEnvironmentChoice() {
  const environments = useAppStore((s) => s.environments)
  const folders = useAppStore((s) => s.folders)
  const folderId = useAppStore((s) => selectActiveTab(s)?.request?.folderId || '')
  const active = useAppStore(findActiveEnvironment)
  return useMemo(() => {
    const { collectionId, own, shared } = offeredEnvironments(environments, folders, folderId)
    const collectionName = own.length > 0 ? folders.find((folder) => folder.id === collectionId)?.name || '' : ''
    return { folderId, collectionId, collectionName, own, shared, offered: [...own, ...shared], active }
  }, [environments, folders, folderId, active])
}
