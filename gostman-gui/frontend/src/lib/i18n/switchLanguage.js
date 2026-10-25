import { flushPendingWrites } from '../../store/appStore'
import { updatePreferences } from '../preferences'

export async function switchLanguage(preference) {
  updatePreferences({ language: preference })
  await flushPendingWrites()
  window.location.reload()
}
