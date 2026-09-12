/**
 * Shared framer-motion presets.
 *
 * Two shapes are exported:
 *  - prop bundles, spread straight onto an element: <motion.div {...fadeIn} />
 *  - variant maps, passed to `variants` with "hidden"/"visible"/"exit" states,
 *    so a parent can orchestrate its children.
 */

export const spring = { type: "spring", stiffness: 300, damping: 24 }
export const springSoft = { type: "spring", stiffness: 200, damping: 20 }
export const springSnappy = { type: "spring", stiffness: 500, damping: 30 }
export const springLayout = { type: "spring", stiffness: 300, damping: 30 }

export const easeSmooth = [0.25, 0.4, 0.25, 1]

const durationFast = { duration: 0.15 }
export const durationBase = { duration: 0.3 }

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
}

const fadeInOut = {
  ...fadeIn,
  exit: { opacity: 0 },
}

export const slideUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
}

export const slideDown = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
}

export const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
}


/** Badges, icons and counters that appear in place. */
export const popIn = {
  initial: { scale: 0 },
  animate: { scale: 1 },
}

export const popInOut = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0, opacity: 0 },
}

/** Chips and cards that swap in and out of a row. */
export const scaleInOut = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.8, opacity: 0 },
}

export const scaleInOutSubtle = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}

/** Accordion / disclosure sections. Requires overflow-hidden on the element. */
export const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
}

/** Panel roots: fade the container while its children stagger in. */
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

export const staggerContainerFast = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
}

export const listItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: spring },
  exit: { opacity: 0, y: -6, transition: durationFast },
}

/** Log/message rows that stream in from the side. */
export const streamItem = {
  hidden: { opacity: 0, x: -20, scale: 0.95 },
  visible: { opacity: 1, x: 0, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
}

/** Cards and rows that enter, then collapse away on delete. */
export const cardEnter = {
  initial: { opacity: 0, y: -10, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.9, height: 0 },
  transition: spring,
}

export const overlayFade = {
  ...fadeInOut,
  transition: durationFast,
}

export const dialogPop = {
  initial: { opacity: 0, scale: 0.96, y: -10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: -10 },
  transition: { ...durationFast, ease: "easeOut" },
}

export const tapScale = { whileTap: { scale: 0.98 } }

export const pressable = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
}

export const pressableSubtle = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.99 },
}

export const pressableStrong = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
}

/** Icon-sized buttons need a larger delta to read at that scale. */
export const pressableIcon = {
  whileHover: { scale: 1.1 },
  whileTap: { scale: 0.9 },
}

export const liftOnHover = {
  whileHover: { scale: 1.02, y: -2 },
  whileTap: { scale: 0.98 },
}

const loop = (duration, extra = {}) => ({ duration, repeat: Infinity, ...extra })

/** Breathing highlight for a valid/active state. */
export const pulseGlow = {
  scale: [1, 1.02, 1],
  opacity: [0.5, 0.8, 0.5],
  transition: loop(2, { ease: "easeInOut" }),
}

/** Expanding ring, for "live connection" indicators. */
export const pulseRing = (rgb) => ({
  boxShadow: [
    `0 0 0 0px rgba(${rgb}, 0.4)`,
    `0 0 0 10px rgba(${rgb}, 0)`,
    `0 0 0 0px rgba(${rgb}, 0.4)`,
  ],
  transition: loop(2),
})

export const pulseScale = {
  scale: [1, 1.1, 1],
  opacity: [0.5, 1, 0.5],
  transition: loop(1.5, { ease: "easeInOut" }),
}

export const pulseOpacity = {
  opacity: [0.5, 1, 0.5],
  transition: loop(2),
}

export const heartbeat = {
  scale: [1, 1.2, 1],
  transition: loop(1),
}

export const spin = {
  rotate: 360,
  transition: loop(1, { ease: "linear" }),
}

export const float = {
  y: [0, -10, 0],
  transition: loop(3, { ease: "easeInOut" }),
}

/** Occasional attention nudge on an idle icon. */
export const wiggle = {
  rotate: [0, 5, -5, 0],
  transition: loop(2, { repeatDelay: 3 }),
}

export const rotateTo = (deg) => ({ animate: { rotate: deg }, transition: spring })

/** Offsets a section's entrance so stacked panels cascade instead of popping together. */
export const enterDelay = (seconds) => ({ transition: { ...durationBase, delay: seconds } })

/**
 * Hero entrance. The container drives its children, so the sequence is one
 * orchestrated reveal rather than a set of hand-tuned delays that drift apart.
 */
export const heroContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

export const heroItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeSmooth } },
}
