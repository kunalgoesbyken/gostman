import { useMemo } from "react"
import { Button } from "./ui/button"
import { ColorPicker } from "./ui/colorPicker"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Field } from "./ui/field"
import { TagsInput } from "./ui/tagsInput"
import { TagBadge } from "./TagBadge"
import { ROW_FOLDER } from "../lib/collectionTree"
import { updatePreferences, usePreferences } from "../lib/preferences"
import { automaticSwatch } from "../lib/swatches"
import { chosenTagColor, tagKey, withTagColor } from "../lib/tagColors"
import { collectTags, normalizeTags } from "../lib/tags"
import { LABEL_TEXT as TEXT } from "../lib/treeText"
import { useAppStore } from "../store/appStore"

const NOTE = "text-2xs text-muted-foreground"

function TagColours({ tags }) {
  const { tagColors } = usePreferences()
  if (tags.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium">{TEXT.tagColours}</h3>
      <ul className="flex flex-col gap-2">
        {tags.map((tag) => (
          <li key={tag} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <TagBadge tag={tag} className="px-1.5 py-0.5 text-2xs" />
            <ColorPicker
              label={TEXT.tagColour(tag)}
              value={chosenTagColor(tagColors, tag)}
              automatic={automaticSwatch(tagKey(tag))}
              onChange={(color) => updatePreferences({ tagColors: withTagColor(tagColors, tag, color) })}
            />
          </li>
        ))}
      </ul>
      <p className={NOTE}>{TEXT.tagColoursNote}</p>
    </section>
  )
}

function useLabelTarget(target) {
  const folders = useAppStore((state) => state.folders)
  const requests = useAppStore((state) => state.requests)
  const isFolder = target.kind === ROW_FOLDER
  const item = (isFolder ? folders : requests).find((candidate) => candidate.id === target.id)
  const knownTags = useMemo(() => collectTags([...requests, ...folders]), [requests, folders])
  return { item, isFolder, knownTags }
}

export function LabelDialog({ target, actions, onClose }) {
  const { item, isFolder, knownTags } = useLabelTarget(target)
  const updateScope = useAppStore((state) => state.updateScopeSettings)
  if (!item) return null

  const tags = normalizeTags(item.tags)
  const title = isFolder ? TEXT.folderTitle(item.name) : TEXT.requestTitle(item.name)
  const setTags = (next) => (isFolder ? updateScope(item.id, { tags: next }) : actions.setRequestTags(item, next))

  return (
    <Dialog label={title} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        {isFolder && (
          <div className="flex flex-col gap-1.5">
            <Field label={TEXT.colour} grouped>
              <ColorPicker label={TEXT.colour} value={item.color} onChange={(color) => updateScope(item.id, { color })} />
            </Field>
            <p className={NOTE}>{TEXT.colourNote}</p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Field label={TEXT.tags} grouped>
            <TagsInput value={tags} onChange={setTags} label={TEXT.tags} placeholder={TEXT.tagsPlaceholder} suggestions={knownTags} />
          </Field>
          <p className={NOTE}>{isFolder ? TEXT.folderTagsNote : TEXT.requestTagsNote}</p>
        </div>
        <TagColours tags={tags} />
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>{TEXT.done}</Button>
      </DialogFooter>
    </Dialog>
  )
}
