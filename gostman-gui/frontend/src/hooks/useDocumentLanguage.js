import { useEffect } from 'react'
import { ENGLISH, activeLanguage } from '../lib/i18n/core'
import { directionOf } from '../lib/i18n/languages'

const LEFT_TO_RIGHT = 'ltr'

export function useDocumentLanguage() {
  useEffect(() => {
    const root = document.documentElement
    const language = activeLanguage()
    root.lang = language
    root.dir = directionOf(language)
    return () => {
      root.lang = ENGLISH
      root.dir = LEFT_TO_RIGHT
    }
  }, [])
}
