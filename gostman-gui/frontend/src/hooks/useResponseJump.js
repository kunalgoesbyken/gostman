import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'

export function useResponseJump(tabId, reveal) {
  const jump = useAppStore((state) => state.responseJump)
  const handled = useRef(jump.nonce)

  useEffect(() => {
    if (jump.nonce === handled.current || jump.tabId !== tabId) return
    handled.current = jump.nonce
    reveal(jump.query)
  }, [jump, tabId, reveal])
}
