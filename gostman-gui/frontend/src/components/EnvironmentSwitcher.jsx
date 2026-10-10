import { Pencil, Plus, Trash2 } from "lucide-react"
import { IconButton } from "./ui/button"
import { Select } from "./ui/select"
import { useAppStore } from "../store/appStore"

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
    showPrompt(title, "Environment name", currentName, "Staging", (name) => {
      const trimmed = name?.trim()
      if (trimmed) onName(trimmed)
    })
  }

  const handleAdd = () => promptForName("New environment", "", addEnvironment)

  const handleRename = () => {
    promptForName("Rename environment", active.name, (name) => renameEnvironment(active.id, name))
  }

  const handleDelete = () => {
    showConfirm(
      "Delete environment",
      `Delete "${active.name}" and its variables? This can't be undone.`,
      () => deleteEnvironment(active.id),
      null,
      "destructive"
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Select
        value={active.id}
        onChange={(event) => setActiveEnvironment(event.target.value)}
        aria-label="Active environment"
        title={active.name}
        controlSize="md"
        className="w-28 md:w-44"
      >
        {environments.map((environment) => (
          <option key={environment.id} value={environment.id}>
            {environment.name}
          </option>
        ))}
      </Select>
      <IconButton label="New environment" icon={Plus} size="icon" onClick={handleAdd} />
      <IconButton label="Rename environment" icon={Pencil} size="icon" onClick={handleRename} />
      <IconButton
        label="Delete environment"
        icon={Trash2}
        size="icon"
        onClick={handleDelete}
        disabled={environments.length === 1}
      />
    </div>
  )
}
