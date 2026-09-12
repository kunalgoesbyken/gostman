import { AlertDialog } from "./ui/AlertDialog"
import { ConfirmDialog } from "./ui/ConfirmDialog"
import { PromptDialog } from "./ui/PromptDialog"
import { CommandPalette } from "./ui/CommandPalette"
import { useAppStore } from "../store/appStore"

export function AppDialogs({ onCommand }) {
  const alertDialog = useAppStore((s) => s.alertDialog)
  const confirmDialog = useAppStore((s) => s.confirmDialog)
  const promptDialog = useAppStore((s) => s.promptDialog)
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen)

  const closeAlert = useAppStore((s) => s.closeAlert)
  const closeConfirm = useAppStore((s) => s.closeConfirm)
  const closePrompt = useAppStore((s) => s.closePrompt)
  const closeCommandPalette = useAppStore((s) => s.closeCommandPalette)

  return (
    <>
      <AlertDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        confirmText={alertDialog.confirmText}
        variant={alertDialog.variant}
        onConfirm={closeAlert}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={() => {
          confirmDialog.onConfirm?.()
          closeConfirm()
        }}
        onCancel={closeConfirm}
      />

      <PromptDialog
        isOpen={promptDialog.isOpen}
        title={promptDialog.title}
        message={promptDialog.message}
        placeholder={promptDialog.placeholder}
        defaultValue={promptDialog.defaultValue}
        confirmText={promptDialog.confirmText}
        onConfirm={(value) => {
          promptDialog.onConfirm?.(value)
          closePrompt()
        }}
        onCancel={closePrompt}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={closeCommandPalette}
        onCommand={onCommand}
      />
    </>
  )
}
