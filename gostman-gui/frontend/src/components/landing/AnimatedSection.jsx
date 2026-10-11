import { motion } from "framer-motion"
import { easeSmooth } from "../../lib/motion"

const ONCE = { once: true, amount: 0.2 }

const OFFSETS = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
}

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
