const SIZES = {
  compact: { width: 640, height: 480, minWidth: 360, minHeight: 280 },
  standard: { width: 768, height: 576, minWidth: 480, minHeight: 360 },
  wide: { width: 1024, height: 640, minWidth: 640, minHeight: 400 },
}

export const toolWindow = (id, size = "standard") => ({ id, ...SIZES[size] })
