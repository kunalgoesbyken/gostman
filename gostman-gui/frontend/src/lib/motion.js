export const springLayout = { type: "spring", stiffness: 300, damping: 30 }

export const easeSmooth = [0.25, 0.4, 0.25, 1]

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
}

export const slideUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
}

export const slideDown = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
}

export const popIn = {
  initial: { scale: 0 },
  animate: { scale: 1 },
}

export const scaleInOut = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.8, opacity: 0 },
}

export const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
}

export const tapScale = { whileTap: { scale: 0.98 } }

export const spin = {
  rotate: 360,
  transition: { duration: 1, repeat: Infinity, ease: "linear" },
}
