import { lazy, Suspense, useEffect } from "react"
import { AlertDialog } from "./ui/AlertDialog"
import { ConfirmDialog } from "./ui/ConfirmDialog"
import { PromptDialog } from "./ui/PromptDialog"
import { DialogPending } from "./ui/dialog"
import { VariablePromptDialog } from "./VariablePromptDialog"
import { whenIdle } from "../lib/idle"
import { useTrashStore } from "../lib/trashSession"
import { useAppStore } from "../store/appStore"
import { useEnvironmentChoice } from "../hooks/useEnvironmentChoice"
import { holdsCollections } from "../lib/environmentScope"

const loadCommandPalette = () => import("./ui/CommandPalette")
const CommandPalette = lazy(() => loadCommandPalette().then((module) => ({ default: module.CommandPalette })))
const AboutDialog = lazy(() => import("./AboutDialog").then((module) => ({ default: module.AboutDialog })))
const ExploreDialog = lazy(() => import("./ExploreDialog").then((module) => ({ default: module.ExploreDialog })))
const WhatsNewDialog = lazy(() => import("./WhatsNewDialog").then((module) => ({ default: module.WhatsNewDialog })))
const PreferencesDialog = lazy(() => import("./PreferencesDialog").then((module) => ({ default: module.PreferencesDialog })))
const ShortcutsDialog = lazy(() => import("./ShortcutsDialog").then((module) => ({ default: module.ShortcutsDialog })))
const EnvironmentDialog = lazy(() => import("./EnvironmentDialog").then((module) => ({ default: module.EnvironmentDialog })))
const DeleteDataDialog = lazy(() => import("./DeleteDataDialog").then((module) => ({ default: module.DeleteDataDialog })))
const TrashDialog = lazy(() => import("./TrashDialog").then((module) => ({ default: module.TrashDialog })))

function Pending({ children }) {
  return <Suspense fallback={<DialogPending />}>{children}</Suspense>
}

export function AppDialogs({ onCommand, secrets, listFonts, windowFrame, hasWorkspaces, isAiOn, ai, trash, backups, relay, updates }) {
  const isTrashOpen = useTrashStore((s) => s.isOpen)
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
  const seenVersion = useAppStore((s) => s.seenVersion)
  const exploreOpen = useAppStore((s) => s.exploreOpen)
  const closeExplore = useAppStore((s) => s.closeExplore)
  const whatsNewOpen = useAppStore((s) => s.whatsNewOpen)
  const closeWhatsNew = useAppStore((s) => s.closeWhatsNew)
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

  useEffect(() => whenIdle(loadCommandPalette), [])

  return (
    <>
      {commandPaletteOpen && <Suspense fallback={null}><CommandPalette
        isOpen
        mode={commandPaletteMode}
        requests={requests}
        folders={folders}
        history={requestHistory}
        onShowShortcuts={openShortcutsDialog}
        environments={environments}
        workspaces={hasWorkspaces ? workspaces : null}
        seenVersion={seenVersion}
        isAiOn={isAiOn}
        holdsCollections={isAppStorage}
        activeEnvironmentId={activeEnvironment?.id || ""}
        onClose={closeCommandPalette}
        onCommand={onCommand}
      /></Suspense>}

      {aboutOpen && <Pending><AboutDialog onClose={closeAbout} /></Pending>}
      {exploreOpen && <Pending><ExploreDialog onClose={closeExplore} /></Pending>}
      {whatsNewOpen && <Pending><WhatsNewDialog onClose={closeWhatsNew} /></Pending>}
      {preferencesDialogOpen && <Pending><PreferencesDialog listFonts={listFonts} windowFrame={windowFrame} onCommand={onCommand} backups={backups} relay={relay} updates={updates} ai={ai} onClose={closePreferencesDialog} /></Pending>}
      {shortcutsDialogOpen && <Pending><ShortcutsDialog onClose={closeShortcutsDialog} /></Pending>}
      {environmentDialogOpen && <Pending><EnvironmentDialog secrets={secrets} onClose={closeEnvironmentDialog} /></Pending>}
      {isTrashOpen && <Pending><TrashDialog actions={trash} /></Pending>}
      <VariablePromptDialog />
      {deleteDataDialog.isOpen && <Pending>
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
      </Pending>}

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
