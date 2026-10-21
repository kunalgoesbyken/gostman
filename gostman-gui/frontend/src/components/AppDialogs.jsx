import { AlertDialog } from "./ui/AlertDialog"
import { ConfirmDialog } from "./ui/ConfirmDialog"
import { PromptDialog } from "./ui/PromptDialog"
import { CommandPalette } from "./ui/CommandPalette"
import { PreferencesDialog } from "./PreferencesDialog"
import { ShortcutsDialog } from "./ShortcutsDialog"
import { EnvironmentDialog } from "./EnvironmentDialog"
import { VariablePromptDialog } from "./VariablePromptDialog"
import { useAppStore } from "../store/appStore"

export function AppDialogs({ onCommand, secrets }) {
  const alertDialog = useAppStore((s) => s.alertDialog)
  const confirmDialog = useAppStore((s) => s.confirmDialog)
  const promptDialog = useAppStore((s) => s.promptDialog)
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen)
  const environments = useAppStore((s) => s.environments)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const commandPaletteMode = useAppStore((s) => s.commandPaletteMode)
  const requests = useAppStore((s) => s.requests)
  const folders = useAppStore((s) => s.folders)
  const requestHistory = useAppStore((s) => s.requestHistory)
  const shortcutsDialogOpen = useAppStore((s) => s.shortcutsDialogOpen)
  const preferencesDialogOpen = useAppStore((s) => s.preferencesDialogOpen)
  const environmentDialogOpen = useAppStore((s) => s.environmentDialogOpen)
  const closeEnvironmentDialog = useAppStore((s) => s.closeEnvironmentDialog)
  const closeShortcutsDialog = useAppStore((s) => s.closeShortcutsDialog)
  const closePreferencesDialog = useAppStore((s) => s.closePreferencesDialog)
  const openShortcutsDialog = useAppStore((s) => s.openShortcutsDialog)

  const closeAlert = useAppStore((s) => s.closeAlert)
  const closeConfirm = useAppStore((s) => s.closeConfirm)
  const closePrompt = useAppStore((s) => s.closePrompt)
  const closeCommandPalette = useAppStore((s) => s.closeCommandPalette)

  return (
    <>
      <CommandPalette
        isOpen={commandPaletteOpen}
        mode={commandPaletteMode}
        requests={requests}
        folders={folders}
        history={requestHistory}
        onShowShortcuts={openShortcutsDialog}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onClose={closeCommandPalette}
        onCommand={onCommand}
      />

      {shortcutsDialogOpen && <ShortcutsDialog onClose={closeShortcutsDialog} />}
      {preferencesDialogOpen && <PreferencesDialog onClose={closePreferencesDialog} />}
      {environmentDialogOpen && <EnvironmentDialog secrets={secrets} onClose={closeEnvironmentDialog} />}
      <VariablePromptDialog />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={() => {
          closeConfirm()
          confirmDialog.onConfirm?.()
        }}
        onCancel={() => {
          closeConfirm()
          confirmDialog.onCancel?.()
        }}
      />

      <PromptDialog
        isOpen={promptDialog.isOpen}
        title={promptDialog.title}
        message={promptDialog.message}
        placeholder={promptDialog.placeholder}
        defaultValue={promptDialog.defaultValue}
        confirmText={promptDialog.confirmText}
        onConfirm={(value) => {
          closePrompt()
          promptDialog.onConfirm?.(value)
        }}
        onCancel={closePrompt}
      />

      <AlertDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        confirmText={alertDialog.confirmText}
        variant={alertDialog.variant}
        onConfirm={closeAlert}
      />
    </>
  )
}
