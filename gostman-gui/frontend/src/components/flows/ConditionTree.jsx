import { ListPlus, X } from "lucide-react"
import { Button, IconButton } from "../ui/button"
import { SegmentedControl } from "../ui/segmented"
import { AssertionEditor } from "../TestsPanel"
import { FLOW_EDITOR_TEXT as TEXT } from "../../lib/flowsText"
import { MATCHES, MAX_GROUP_DEPTH, blankGroup, hasGroups, isGroup } from "../../lib/flows/conditions"
import { conditionFormula } from "../../lib/flows/describe"
import { blankCondition } from "../../lib/flows/edit"
import { parseAssertions, serializeAssertions } from "../../lib/scripting/assertions"

export function MatchControl({ value, onChange }) {
  const matches = MATCHES.map((match) => ({ value: match, label: TEXT.matches[match] }))
  return <SegmentedControl label={TEXT.match} options={matches} value={value} onChange={onChange} />
}

export function ChecksEditor({ conditions, onChange, EditorComponent, isNested = false }) {
  return (
    <div className={isNested ? "[&>div]:p-0" : "-mx-3 [&>div]:p-0 [&>div]:px-3"}>
      <AssertionEditor assertions={serializeAssertions(conditions)} onChange={(json) => onChange(parseAssertions(json))} EditorComponent={EditorComponent} />
    </div>
  )
}

const leavesOf = (conditions) => conditions.filter((item) => !isGroup(item))

const groupsOf = (conditions) => conditions.filter(isGroup)

function Level({ match, conditions, depth, onChange, EditorComponent }) {
  const leaves = leavesOf(conditions)
  const groups = groupsOf(conditions)
  const commit = (nextLeaves, nextGroups) => onChange({ match, conditions: [...nextLeaves, ...nextGroups] })
  const patchGroup = (position, group) => commit(leaves, groups.map((current, at) => (at === position ? group : current)))
  const removeGroup = (position) => commit(leaves, groups.filter((_, at) => at !== position))
  const canNest = depth <= MAX_GROUP_DEPTH
  return (
    <>
      <ChecksEditor conditions={leaves} onChange={(next) => commit(next, groups)} EditorComponent={EditorComponent} isNested={depth > 1} />
      {groups.map((group, position) => (
        <div key={position} className="flex flex-col gap-2 border-s-2 border-border ps-3">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-medium text-muted-foreground">{TEXT.groupTitle}</span>
            <MatchControl value={group.match} onChange={(next) => patchGroup(position, { ...group, match: next })} />
            <IconButton label={TEXT.removeGroup} icon={X} onClick={() => removeGroup(position)} className="ms-auto" />
          </div>
          <Level
            match={group.match}
            conditions={group.conditions}
            depth={depth + 1}
            onChange={(next) => patchGroup(position, { ...group, ...next })}
            EditorComponent={EditorComponent}
          />
        </div>
      ))}
      {canNest && (
        <Button variant="ghost" size="sm" onClick={() => commit(leaves, [...groups, blankGroup(match, [blankCondition()])])} className="self-start">
          <ListPlus />
          {TEXT.addGroup}
        </Button>
      )}
    </>
  )
}

export function ConditionTree({ match, conditions, onChange, EditorComponent }) {
  const formula = hasGroups(conditions) ? conditionFormula(match, conditions) : ""
  return (
    <div className="flex flex-col gap-2">
      <MatchControl value={match} onChange={(next) => onChange({ match: next, conditions })} />
      <Level match={match} conditions={conditions} depth={1} onChange={onChange} EditorComponent={EditorComponent} />
      {formula && (
        <p className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-2xs text-foreground">
          <span className="font-sans text-muted-foreground">{TEXT.reads} </span>
          {formula}
        </p>
      )}
    </div>
  )
}
