import { motion } from "framer-motion"
import { easeSmooth } from "../../lib/motion"

const ONCE = { once: true, amount: 0.2 }

const OFFSETS = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
}

/**
 * Scroll-reveal wrapper. Every landing section that fades in on scroll should
 * use this (or a sibling below) rather than hand-rolling whileInView/viewport.
 */
export const AnimatedSection = ({ children, className = "", delay = 0, direction = "up" }) => {
  const variants = {
    hidden: { opacity: 0, y: 0, x: 0, ...OFFSETS[direction] },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: { duration: 0.6, delay, ease: easeSmooth },
    },
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={ONCE}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export const StaggerContainer = ({ children, className = "", staggerDelay = 0.1 }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: staggerDelay, delayChildren: 0.2 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeSmooth } },
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      variants={containerVariants}
      className={className}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div key={i} variants={itemVariants}>
              {child}
            </motion.div>
          ))
        : children}
    </motion.div>
  )
}

const RESTING = { opacity: 1, scale: 1, x: 0 }

const revealOnScroll = (hidden, duration) => {
  const visible = Object.fromEntries(Object.keys(hidden).map((key) => [key, RESTING[key]]))

  return ({ children, className = "", delay = 0 }) => (
    <motion.div
      initial={hidden}
      whileInView={visible}
      viewport={{ once: true }}
      transition={{ duration, delay, ease: easeSmooth }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export const ScaleIn = revealOnScroll({ opacity: 0, scale: 0.9 }, 0.5)
export const SlideInFromLeft = revealOnScroll({ opacity: 0, x: -60 }, 0.6)
export const SlideInFromRight = revealOnScroll({ opacity: 0, x: 60 }, 0.6)
