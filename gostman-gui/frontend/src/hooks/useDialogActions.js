import { useAppStore } from "../store/appStore"

export function useDialogActions() {
  const showAlert = useAppStore((s) => s.showAlert)
  const showConfirm = useAppStore((s) => s.showConfirm)
  const showPrompt = useAppStore((s) => s.showPrompt)
  const openCommandPalette = useAppStore((s) => s.openCommandPalette)

  return { showAlert, showConfirm, showPrompt, openCommandPalette }
}
