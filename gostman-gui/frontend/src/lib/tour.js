import { create } from 'zustand'

export const TOUR_STEP_IDS = ['send', 'variables', 'tools', 'explore']

export const TOUR_FINISHED = TOUR_STEP_IDS.length

export const useTourStore = create(() => ({ isReplaying: false }))

export const startTourReplay = () => useTourStore.setState({ isReplaying: true })

export const endTourReplay = () => useTourStore.setState({ isReplaying: false })
