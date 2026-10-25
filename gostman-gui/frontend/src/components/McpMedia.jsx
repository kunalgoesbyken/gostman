import { MEDIA_AUDIO, MEDIA_IMAGE } from "../lib/mcpMedia"
import { MCP_TEXT } from "../lib/mcpText"

function MediaItem({ item, index }) {
  const label = MCP_TEXT.media[item.kind](index + 1)
  return (
    <li className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      {item.kind === MEDIA_IMAGE && <img src={item.url} alt={label} className="max-h-64 max-w-full self-start rounded border border-border object-contain" />}
      {item.kind === MEDIA_AUDIO && <audio src={item.url} controls aria-label={label} className="w-full max-w-xl" />}
    </li>
  )
}

export function McpMedia({ media }) {
  return (
    <ul aria-label={MCP_TEXT.media.heading} className="flex flex-col gap-3 border-b border-border px-3 py-2 text-xs">
      {media.map((item, index) => <MediaItem key={index} item={item} index={index} />)}
    </ul>
  )
}
