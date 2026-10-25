import { ArrowDown, ArrowUp, ClipboardPaste, Copy, FileCheck, FileSearch, Folder, FolderInput, FolderPlus, ListChecks, Palette, Pencil, Plus, RefreshCw, Settings2, Share2, Tag, Trash2 } from "lucide-react"
import { CONTRACT_TEXT } from "./checksText"
import { ROOT_ID, ROW_FOLDER, ROW_REQUEST, listFolders } from "./collectionTree"
import { FOLDER_SETTINGS_TEXT } from "./folderSettingsText"
import { SPEC_TEXT } from "./specText"
import { STEP_DOWN, STEP_UP, canDropFolder } from "./treeMoves"
import { TREE_TEXT } from "./treeText"

export const MENU_ACTIONS = "actions"
export const MENU_MOVE = "move"

function specMenuItems(folder, actions, { checksContract, syncsSpec }) {
  return [
    ...(syncsSpec ? [{ id: "spec-sync", label: SPEC_TEXT.checkForUpdates, icon: RefreshCw, onSelect: () => actions.openapi.check(folder.id) }] : []),
    { id: "spec-browse", label: SPEC_TEXT.browseSpec, icon: FileSearch, onSelect: () => actions.openapi.browseFolder(folder.id) },
    { id: "spec-contract", label: checksContract ? CONTRACT_TEXT.stop : CONTRACT_TEXT.start, icon: FileCheck, onSelect: () => actions.openapi.toggleContract(folder.id) },
  ]
}

function arrangeItems(source, context) {
  const { actions, showMoveTargets, hasClipboard, pasteRow } = context
  return [
    { id: "move-up", label: TREE_TEXT.moveUp, icon: ArrowUp, disabled: !actions.tree.canStep(source, STEP_UP), onSelect: () => actions.tree.stepItem(source, STEP_UP) },
    { id: "move-down", label: TREE_TEXT.moveDown, icon: ArrowDown, disabled: !actions.tree.canStep(source, STEP_DOWN), onSelect: () => actions.tree.stepItem(source, STEP_DOWN) },
    { id: "move", label: TREE_TEXT.moveToFolder, icon: FolderInput, keepOpen: true, onSelect: showMoveTargets },
    { id: "copy", label: TREE_TEXT.copy, icon: Copy, onSelect: () => actions.tree.copyItem(source) },
    { id: "paste", label: TREE_TEXT.paste, icon: ClipboardPaste, disabled: !hasClipboard, onSelect: () => actions.tree.pasteItem(pasteRow) },
    { id: "duplicate", label: TREE_TEXT.duplicate, icon: Copy, onSelect: () => actions.tree.duplicateItem(source) },
  ]
}

function folderMenuItems(folder, context) {
  const { actions, isLinked, isCollection, editLabels } = context
  const source = { kind: ROW_FOLDER, id: folder.id }
  return [
    { id: "new-request", label: "New request", icon: Plus, onSelect: () => actions.newRequest(folder.id) },
    { id: "new-subfolder", label: "New subfolder", icon: FolderPlus, onSelect: () => actions.createFolder(folder.id) },
    { id: "run", label: "Run folder", icon: ListChecks, onSelect: () => actions.openRunner(folder.id) },
    { id: "share", label: "Share folder", icon: Share2, onSelect: () => actions.shareFolder(folder.id) },
    ...(isLinked ? specMenuItems(folder, actions, context) : [{ id: "spec-link", label: CONTRACT_TEXT.link, icon: FileCheck, onSelect: () => actions.openapi.linkFolder(folder) }]),
    { id: "settings", label: isCollection ? FOLDER_SETTINGS_TEXT.collectionMenu : FOLDER_SETTINGS_TEXT.menuSettings, icon: Settings2, onSelect: () => actions.openFolderSettings(folder.id) },
    { id: "labels", label: TREE_TEXT.editLabels, icon: Palette, onSelect: () => editLabels(source) },
    ...arrangeItems(source, { ...context, pasteRow: source }),
    { id: "rename", label: "Rename", icon: Pencil, onSelect: () => actions.renameFolder(folder) },
    { id: "delete", label: "Delete", icon: Trash2, destructive: true, onSelect: () => actions.deleteFolder(folder) },
  ]
}

function requestMenuItems(request, context) {
  const { actions, editLabels } = context
  const source = { kind: ROW_REQUEST, id: request.id }
  return [
    { id: "rename", label: "Rename", icon: Pencil, onSelect: () => actions.renameRequest(request) },
    { id: "tags", label: TREE_TEXT.editTags, icon: Tag, onSelect: () => editLabels(source) },
    { id: "share", label: TREE_TEXT.shareRequest, icon: Share2, onSelect: () => actions.shareRequest(request.id) },
    ...arrangeItems(source, { ...context, pasteRow: source }),
    { id: "delete", label: "Delete", icon: Trash2, destructive: true, onSelect: () => actions.deleteRequest(request) },
  ]
}

export function moveTargetItems(source, subject, context) {
  const { tree, actions, state } = context
  const currentParent = (source.kind === ROW_FOLDER ? subject.parentId : subject.folderId) || ROOT_ID
  const isAllowed = (folderId) => source.kind !== ROW_FOLDER || canDropFolder(state.folders, source.id, folderId)
  const topLevel = {
    id: "top-level",
    label: TREE_TEXT.topLevel,
    disabled: currentParent === ROOT_ID,
    onSelect: () => actions.tree.moveToFolder(source, ROOT_ID),
  }
  const targets = listFolders(tree).map(({ folder, depth }) => ({
    id: folder.id,
    label: folder.name,
    icon: Folder,
    indent: depth,
    disabled: folder.id === currentParent || !isAllowed(folder.id) || folder.id === source.id,
    onSelect: () => actions.tree.moveToFolder(source, folder.id),
  }))
  return [topLevel, ...targets]
}

export function menuItemsFor(menu, context) {
  const { row } = menu
  if (menu.view === MENU_MOVE) {
    const isFolder = row.kind === ROW_FOLDER
    const source = { kind: row.kind, id: isFolder ? row.folder.id : row.request.id }
    return moveTargetItems(source, isFolder ? row.folder : row.request, context)
  }
  if (row.kind === ROW_FOLDER) return folderMenuItems(row.folder, context)
  return requestMenuItems(row.request, context)
}
