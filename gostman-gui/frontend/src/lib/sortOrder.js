export const cleanOrder = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0)

export function compareOrder(first, second) {
  const firstOrder = cleanOrder(first.sortOrder)
  const secondOrder = cleanOrder(second.sortOrder)
  if (firstOrder === secondOrder) return 0
  if (firstOrder === 0) return 1
  if (secondOrder === 0) return -1
  return firstOrder - secondOrder
}
