import { memo, useRef, useState } from "react"
import { Copy, FileCode, FileUp, Import, Link, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { Button, IconButton } from "../ui/button"
import { ContextMenu } from "../ui/ContextMenu"
import { Toolbar } from "../ui/panel"
import { FeatureEmpty } from "../FeatureEmpty"
import { SPEC_EDITOR_TEXT, SPEC_LIST_TEXT as TEXT } from "../../lib/specEditorText"
import { TEMPLATE_IDS } from "../../lib/specTemplates"
import { ORIENTATION, moveFocus } from "../../lib/rovingFocus"
import { isRemoveKey } from "../../lib/shortcuts"
import { cn } from "../../lib/utils"
import { selectActiveTab, useAppStore } from "../../store/appStore"

const ROW_KEYS = { selector: "[data-spec-row]", orientation: ORIENTATION.vertical }
const SPEC_FILE_TYPES = ".json,.yaml,.yml"

function SpecRow({ spec, isActive, actions, onMenu }) {
  const openMenu = (event) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    onMenu(spec.id, { x: event.clientX || rect.left, y: event.clientY || rect.bottom })
  }
  const handleKeyDown = (event) => {
    if (!isRemoveKey(event)) return
    event.preventDefault()
    actions.remove(spec.id)
  }
  return (
    <li className="group relative flex items-center" onContextMenu={openMenu}>
      <button
        type="button"
        data-spec-row={spec.id}
        aria-current={isActive || undefined}
        onClick={() => actions.open(spec.id)}
        onKeyDown={handleKeyDown}
        className={cn("flex h-8 min-w-0 flex-1 items-center gap-2 ps-3 pe-9 text-start text-xs hover:bg-accent", isActive ? "bg-accent text-foreground" : "text-muted-foreground")}
      >
        <FileCode aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-foreground">{spec.name}</span>
      </button>
      <IconButton
        label={TEXT.actions({ name: spec.name })}
        icon={MoreHorizontal}
        size="icon-xs"
        onClick={openMenu}
        className="absolute end-1.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
      />
    </li>
  )
}

const rowMenu = (specId, actions) => [
  { id: "rename", label: TEXT.rename, icon: Pencil, onSelect: () => actions.rename(specId) },
  { id: "duplicate", label: TEXT.duplicate, icon: Copy, onSelect: () => actions.duplicate(specId) },
  { id: "delete", label: TEXT.remove, icon: Trash2, destructive: true, onSelect: () => actions.remove(specId) },
]

const addMenu = (actions, chooseFile) => [
  ...TEMPLATE_IDS.map((templateId) => ({
    id: `template-${templateId}`,
    label: SPEC_EDITOR_TEXT.templates[templateId].name,
    description: SPEC_EDITOR_TEXT.templates[templateId].description,
    icon: Plus,
    onSelect: () => actions.create(templateId),
  })),
  { id: "import-file", label: TEXT.importFile, icon: FileUp, onSelect: chooseFile },
  { id: "import-address", label: TEXT.importAddress, icon: Link, onSelect: actions.promptAddress },
]

export const SpecList = memo(function SpecList({ actions }) {
  const specs = useAppStore((state) => state.specs)
  const activeSpecId = useAppStore((state) => selectActiveTab(state).specId)
  const [menu, setMenu] = useState(null)
  const [addPosition, setAddPosition] = useState(null)
  const fileRef = useRef(null)

  const pickFile = async (event) => {
    const [file] = event.target.files
    event.target.value = ""
    if (file) await actions.importFile(file)
  }

  const openAddMenu = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setAddPosition(addPosition ? null : { x: rect.right, y: rect.bottom })
  }

  const fileInput = <input ref={fileRef} type="file" accept={SPEC_FILE_TYPES} onChange={pickFile} className="hidden" />
  const addContextMenu = addPosition && <ContextMenu position={addPosition} title={TEXT.newSpec} items={addMenu(actions, () => fileRef.current.click())} onClose={() => setAddPosition(null)} />

  if (specs.length === 0) {
    return (
      <>
        <FeatureEmpty
          surface="specs"
          hideTry
          icon={FileCode}
          title={TEXT.emptyTitle}
          description={TEXT.emptyDescription}
          before={(
            <div className="flex flex-col items-center gap-1.5">
              <Button size="sm" onClick={() => actions.create()}>
                <Plus />
                {TEXT.newSpec}
              </Button>
              <Button size="sm" variant="ghost" aria-haspopup="menu" aria-expanded={Boolean(addPosition)} onClick={openAddMenu}>
                <Import />
                {TEXT.importSpec}
              </Button>
            </div>
          )}
        />
        {fileInput}
        {addContextMenu}
      </>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar className="justify-between pe-1.5">
        <span className="text-xs text-muted-foreground">{TEXT.count({ count: specs.length })}</span>
        <IconButton label={TEXT.newSpec} icon={Plus} aria-haspopup="menu" aria-expanded={Boolean(addPosition)} onClick={openAddMenu} />
      </Toolbar>
      <ul aria-label={TEXT.listLabel} onKeyDown={(event) => moveFocus(event, ROW_KEYS)} className="min-h-0 flex-1 overflow-y-auto py-1">
        {specs.map((spec) => (
          <SpecRow key={spec.id} spec={spec} isActive={spec.id === activeSpecId} actions={actions} onMenu={(specId, position) => setMenu({ specId, position })} />
        ))}
      </ul>
      {fileInput}
      {addContextMenu}
      {menu && <ContextMenu position={menu.position} title="" items={rowMenu(menu.specId, actions)} onClose={() => setMenu(null)} />}
    </div>
  )
})
