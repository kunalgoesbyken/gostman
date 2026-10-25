import { AlertDialog } from "./ui/AlertDialog"
import { ConfirmDialog } from "./ui/ConfirmDialog"
import { PromptDialog } from "./ui/PromptDialog"
import { CommandPalette } from "./ui/CommandPalette"
import { AboutDialog } from "./AboutDialog"
import { PreferencesDialog } from "./PreferencesDialog"
import { ShortcutsDialog } from "./ShortcutsDialog"
import { EnvironmentDialog } from "./EnvironmentDialog"
import { VariablePromptDialog } from "./VariablePromptDialog"
import { DeleteDataDialog } from "./DeleteDataDialog"
import { useAppStore } from "../store/appStore"
import { useEnvironmentChoice } from "../hooks/useEnvironmentChoice"
import { holdsCollections } from "../lib/environmentScope"

export function AppDialogs({ onCommand, secrets, listFonts, windowFrame, hasWorkspaces, hasLoadTest, isAiOn, ai, backups, relay, updates }) {
  const alertDialog = useAppStore((s) => s.alertDialog)
  const confirmDialog = useAppStore((s) => s.confirmDialog)
  const promptDialog = useAppStore((s) => s.promptDialog)
  const deleteDataDialog = useAppStore((s) => s.deleteDataDialog)
  const closeDeleteData = useAppStore((s) => s.closeDeleteData)
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen)
  const { offered: environments, active: activeEnvironment } = useEnvironmentChoice()
  const commandPaletteMode = useAppStore((s) => s.commandPaletteMode)
  const requests = useAppStore((s) => s.requests)
  const workspaces = useAppStore((s) => s.workspaceStatus.workspaces)
  const isAppStorage = useAppStore((s) => holdsCollections(s.workspaceStatus.path))
  const folders = useAppStore((s) => s.folders)
  const requestHistory = useAppStore((s) => s.requestHistory)
  const aboutOpen = useAppStore((s) => s.aboutOpen)
  const closeAbout = useAppStore((s) => s.closeAbout)
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
        workspaces={hasWorkspaces ? workspaces : null}
        hasLoadTest={hasLoadTest}
        isAiOn={isAiOn}
        holdsCollections={isAppStorage}
        activeEnvironmentId={activeEnvironment?.id || ""}
        onClose={closeCommandPalette}
        onCommand={onCommand}
      />

      {aboutOpen && <AboutDialog onClose={closeAbout} />}
      {preferencesDialogOpen && <PreferencesDialog listFonts={listFonts} windowFrame={windowFrame} onCommand={onCommand} backups={backups} relay={relay} updates={updates} ai={ai} onClose={closePreferencesDialog} />}
      {shortcutsDialogOpen && <ShortcutsDialog onClose={closeShortcutsDialog} />}
      {environmentDialogOpen && <EnvironmentDialog secrets={secrets} onClose={closeEnvironmentDialog} />}
      <VariablePromptDialog />
      {deleteDataDialog.isOpen && (
        <DeleteDataDialog
          onDelete={() => {
            closeDeleteData()
            deleteDataDialog.onDelete()
          }}
          onExport={() => {
            closeDeleteData()
            onCommand("export")
          }}
          onClose={closeDeleteData}
        />
      )}

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
        alternativeText={confirmDialog.alternative?.text}
        onAlternative={() => {
          closeConfirm()
          confirmDialog.alternative.run()
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
