export const isRtl = () => document.documentElement.dir === "rtl"

export const inlineStart = (rect) => (isRtl() ? rect.right : rect.left)

export const alignInline = (edge, width) => (isRtl() ? edge - width : edge)
