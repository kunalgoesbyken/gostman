export const MAX_CONSOLE_GROUPS = 100
export const ALL_LEVELS = 'all'

export const LEVELS = ['log', 'info', 'warn', 'error', 'debug']

export const addConsoleGroup = (groups, group) => [...groups, group].slice(-MAX_CONSOLE_GROUPS)

export const consoleGroup = (request, logs, sequence) => ({
  id: sequence,
  title: `${request.method} ${request.name}`,
  at: Date.now(),
  lines: logs,
})

export function filterGroups(groups, level) {
  if (level === ALL_LEVELS) return groups
  return groups
    .map((group) => ({ ...group, lines: group.lines.filter((line) => line.level === level) }))
    .filter((group) => group.lines.length > 0)
}

export function formatTime(at) {
  const date = new Date(at)
  return `${date.toLocaleTimeString(undefined, { hour12: false })}.${String(date.getMilliseconds()).padStart(3, '0')}`
}
