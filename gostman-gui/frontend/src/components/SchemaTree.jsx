import { SPEC_TEXT } from "../lib/specText"

const typeText = (node) => [node.ref, node.type, node.format].filter(Boolean).join(" ")

function Flags({ node }) {
  return (
    <>
      {node.required && <span className="text-warning">{SPEC_TEXT.required}</span>}
      {node.deprecated && <span className="text-muted-foreground">{SPEC_TEXT.deprecated}</span>}
      {node.circular && <span className="text-muted-foreground">{SPEC_TEXT.circular}</span>}
      {node.truncated && <span className="text-muted-foreground">{SPEC_TEXT.truncated}</span>}
    </>
  )
}

function Facts({ node }) {
  return (
    <>
      {node.description && <p className="whitespace-pre-wrap text-muted-foreground">{node.description}</p>}
      {node.enum && <p className="text-muted-foreground">{node.enum.join(" | ")}</p>}
      {node.constraints && <p className="text-muted-foreground">{node.constraints}</p>}
    </>
  )
}

export function SchemaTree({ node }) {
  const children = node.properties || []
  return (
    <div className="text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2">
        {node.name && <span className="font-mono font-medium text-foreground">{node.name}</span>}
        <span className="font-mono text-muted-foreground">{typeText(node)}</span>
        <Flags node={node} />
      </div>
      <Facts node={node} />
      {(children.length > 0 || node.items || node.additionalProperties || node.options) && (
        <div className="ml-1 mt-1 space-y-2 border-l border-border pl-3">
          {children.map((child) => <SchemaTree key={child.name} node={child} />)}
          {node.items && <SchemaTree node={{ ...node.items, name: "items" }} />}
          {node.additionalProperties && <SchemaTree node={{ ...node.additionalProperties, name: "additionalProperties" }} />}
          {node.options?.map((option, index) => (
            <SchemaTree key={`${node.combine}-${index}`} node={{ ...option, name: node.combine }} />
          ))}
        </div>
      )}
    </div>
  )
}
