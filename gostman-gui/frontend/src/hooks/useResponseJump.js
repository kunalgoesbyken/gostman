import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

export function useResponseJump(tabId, reveal) {
  const jump = useAppStore((state) => state.responseJump)
  const settle = useAppStore((state) => state.settleResponseJump)

  useEffect(() => {
    if (!jump || jump.tabId !== tabId) return
    reveal(jump)
    settle(jump)
  }, [jump, tabId, reveal, settle])
}
