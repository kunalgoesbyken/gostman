import { create } from 'zustand'

const NOTHING = { open: () => {}, canTry: () => false }

export const useFeatureAccess = create(() => NOTHING)

export const installFeatureAccess = (access) => useFeatureAccess.setState(access, true)

export const releaseFeatureAccess = () => useFeatureAccess.setState(NOTHING, true)
