const CANDIDATES = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[contenteditable="true"]', '[tabindex]']

const FOCUSABLE = CANDIDATES.map((candidate) => `${candidate}:not([tabindex="-1"])`).join(', ')

export const isVisible = (element) => element.offsetParent !== null

export const focusableWithin = (container, selector = FOCUSABLE) => [...container.querySelectorAll(selector)].filter(isVisible)
