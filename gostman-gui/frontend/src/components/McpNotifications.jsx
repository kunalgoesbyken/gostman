import { isPlainObject, parseJSON } from "../lib/dataUtils"
import { MCP_TEXT } from "../lib/mcpText"
import { cn } from "../lib/utils"

const PROGRESS = "notifications/progress"
const LOG_MESSAGE = "notifications/message"
const LEVEL_TONES = {
  warning: "text-warning",
  error: "text-destructive",
  critical: "text-destructive",
  alert: "text-destructive",
  emergency: "text-destructive",
}

const asText = (value) => (typeof value === "string" ? value : JSON.stringify(value))

function summarize({ method, params }) {
  const parsed = parseJSON(params, null)
  if (!isPlainObject(parsed)) return { text: params }
  if (method === PROGRESS) return { text: MCP_TEXT.progress(parsed) }
  if (method === LOG_MESSAGE) return { level: asText(parsed.level ?? ""), text: [parsed.logger, asText(parsed.data ?? "")].filter(Boolean).join(": ") }
  return { text: params }
}

function NotificationRow({ notification }) {
  const { level, text } = summarize(notification)
  return (
    <li className="contents">
      <span className="text-right text-muted-foreground">{MCP_TEXT.notificationTime(notification.atMs)}</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <span className="text-foreground">{notification.method}</span>
        {level && <span className={cn("ml-2", LEVEL_TONES[level] ?? "text-muted-foreground")}>{level}</span>}
        <span className="ml-2 text-muted-foreground">{text}</span>
      </span>
    </li>
  )
}

export function McpNotifications({ notifications }) {
  return (
    <details className="border-b border-border px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none text-muted-foreground">{MCP_TEXT.notifications(notifications.length)}</summary>
      <ol className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 font-mono">
        {notifications.map((notification, index) => <NotificationRow key={index} notification={notification} />)}
      </ol>
    </details>
  )
}
