const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const isVisible = (element) => element.offsetParent !== null

export const focusableWithin = (container, selector = FOCUSABLE) => [...container.querySelectorAll(selector)].filter(isVisible)
