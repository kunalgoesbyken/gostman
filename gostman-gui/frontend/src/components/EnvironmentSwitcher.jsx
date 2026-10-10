import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "./ui/button"
import { Select } from "./ui/select"
import { useAppStore } from "../store/appStore"

const ACTION_BUTTON_CLASS = "h-8 w-8 text-muted-foreground hover:text-foreground"

export function EnvironmentSwitcher() {
  const environments = useAppStore((s) => s.environments)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const setActiveEnvironment = useAppStore((s) => s.setActiveEnvironment)
  const addEnvironment = useAppStore((s) => s.addEnvironment)
  const renameEnvironment = useAppStore((s) => s.renameEnvironment)
  const deleteEnvironment = useAppStore((s) => s.deleteEnvironment)
  const showPrompt = useAppStore((s) => s.showPrompt)
  const showConfirm = useAppStore((s) => s.showConfirm)

  const active = environments.find((environment) => environment.id === activeEnvironmentId)
  if (!active) return null

  const promptForName = (title, currentName, onName) => {
    showPrompt(title, "Environment name:", currentName, "Staging", (name) => {
      const trimmed = name?.trim()
      if (trimmed) onName(trimmed)
    })
  }

  const handleAdd = () => promptForName("New Environment", "", addEnvironment)

  const handleRename = () => {
    promptForName("Rename Environment", active.name, (name) => renameEnvironment(active.id, name))
  }

  const handleDelete = () => {
    showConfirm(
      "Delete Environment",
      `Delete "${active.name}" and its variables? This can't be undone.`,
      () => deleteEnvironment(active.id),
      null,
      "destructive"
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        value={active.id}
        onChange={(event) => setActiveEnvironment(event.target.value)}
        aria-label="Active environment"
        className="h-8 w-40 text-xs"
      >
        {environments.map((environment) => (
          <option key={environment.id} value={environment.id}>
            {environment.name}
          </option>
        ))}
      </Select>
      <Button variant="ghost" size="icon" onClick={handleAdd} aria-label="New environment" title="New environment" className={ACTION_BUTTON_CLASS}>
        <Plus className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleRename} aria-label="Rename environment" title="Rename environment" className={ACTION_BUTTON_CLASS}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        disabled={environments.length === 1}
        aria-label="Delete environment"
        title="Delete environment"
        className={ACTION_BUTTON_CLASS}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
