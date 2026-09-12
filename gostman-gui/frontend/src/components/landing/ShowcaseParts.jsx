import { motion } from "framer-motion"
import { fadeIn, spin } from "../../lib/motion"
import { METHOD_CHIPS } from "../../lib/constants"

export const methodStyle = (method) =>
  METHOD_CHIPS[method] || "text-muted-foreground bg-muted-foreground/10"

export const Spinner = ({ className }) => (
  <motion.span
    className={`border-2 border-current border-t-transparent rounded-full ${className}`}
    animate={spin}
  />
)

export const ShowcaseHeader = ({ icon: Icon, iconClassName, tint, title, subtitle, children }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className={`p-2 rounded-lg ${tint}`}>
      <Icon className={`w-5 h-5 ${iconClassName}`} />
    </div>
    <div className="flex-1">
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
    {children}
  </div>
)

const ENTRANCE = {
  left: { initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 } },
  right: { initial: { opacity: 0, x: 10 }, animate: { opacity: 1, x: 0 } },
  up: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
}

export const ShowcasePanel = ({ className = "", from = "up", delay, children, ...props }) => (
  <motion.div
    className={`bg-background/60 backdrop-blur-sm rounded-lg border border-border/60 overflow-hidden flex flex-col ${className}`}
    {...ENTRANCE[from]}
    {...(delay ? { transition: { delay } } : {})}
    {...props}
  >
    {children}
  </motion.div>
)

export const PanelLabel = ({ children, className = "" }) => (
  <span className={`text-xs font-semibold text-muted-foreground uppercase tracking-wider ${className}`}>
    {children}
  </span>
)

export const EmptyState = ({ icon: Icon, iconClassName, message, messageClassName = "text-xs", className = "" }) => (
  <motion.div
    key="empty"
    {...fadeIn}
    exit={{ opacity: 0 }}
    className={`flex items-center justify-center text-muted-foreground/50 ${className}`}
  >
    <div className="text-center space-y-2">
      <Icon className={`mx-auto opacity-30 ${iconClassName}`} />
      <p className={messageClassName}>{message}</p>
    </div>
  </motion.div>
)

export const ShowcaseFooter = ({ tag, tagClassName, children }) => (
  <motion.div
    className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"
    {...fadeIn}
    transition={{ delay: 0.3 }}
  >
    <span className={`px-2 py-1 rounded font-mono ${tagClassName}`}>{tag}</span>
    {children}
  </motion.div>
)
