export const classes = (...parts) => parts.filter(Boolean).join(" ")

export function keepVisible(container, element) {
  if (!container || !element) return
  const box = container.getBoundingClientRect()
  const item = element.getBoundingClientRect()
  if (item.top >= box.top && item.bottom <= box.bottom) return
  container.scrollTop += item.top - box.top - (box.height - item.height) / 2
}
