import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link2, CheckCircle, Circle } from "lucide-react"
import { collapse, slideUp, spin } from "../../../lib/motion"
import { ShowcaseFooter, ShowcaseHeader, methodStyle } from "../ShowcaseParts"
import { useDemoSequence } from "../useDemoSequence"

const CHAIN_STEPS = [
  {
    id: 1,
    method: "GET",
    url: "/api/users",
    description: "Fetch all users",
    response: {
      data: [
        { id: 101, username: "alice", role: "admin" },
        { id: 102, username: "bob", role: "user" },
      ],
    },
    extract: "$.data[0].id",
    extractValue: "101",
  },
  {
    id: 2,
    method: "GET",
    url: "/api/users/{{userId}}",
    description: "Get specific user details",
    response: {
      id: 101,
      username: "alice",
      email: "alice@example.com",
      profile: { avatar: "avatar.jpg", bio: "Admin user" },
    },
    extract: "$.email",
    extractValue: "alice@example.com",
  },
  {
    id: 3,
    method: "POST",
    url: "/api/auth/send",
    description: "Send auth email to extracted address",
    response: {
      success: true,
      message: "Email sent to alice@example.com",
    },
  },
]

const DEMO_SEQUENCE = [
  { delay: 300, action: "setActive", stepIndex: 0 },
  { delay: 1300, action: "complete", stepIndex: 0 },
  { delay: 1700, action: "setActive", stepIndex: 1 },
  { delay: 2700, action: "complete", stepIndex: 1 },
  { delay: 3100, action: "setActive", stepIndex: 2 },
  { delay: 4100, action: "complete", stepIndex: 2 },
]

const previewValue = (value) => {
  if (typeof value === "string") return `"${value.slice(0, 30)}${value.length > 30 ? "..." : ""}"`
  return typeof value === "object" ? "{...}" : value
}

export const ChainingShowcase = () => {
  const [activeStep, setActiveStep] = useState(null)
  const [completedSteps, setCompletedSteps] = useState([])

  useDemoSequence({
    steps: DEMO_SEQUENCE,
    loopAfter: 6000,
    reset: () => {
      setActiveStep(null)
      setCompletedSteps([])
    },
    onStep: ({ action, stepIndex }) => {
      if (action === "setActive") {
        setActiveStep(stepIndex)
      } else if (action === "complete") {
        setCompletedSteps((prev) => [...prev, stepIndex])
        setActiveStep(null)
      }
    },
  })

  return (
    <div className="w-full h-full flex flex-col">
      <ShowcaseHeader
        icon={Link2}
        iconClassName="text-primary"
        tint="bg-primary/10"
        title="Request Chaining"
        subtitle="Chain requests together with extracted data"
      />

      <div className="flex-1 flex flex-col space-y-3 overflow-auto">
        {CHAIN_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(index)
          const isCurrent = activeStep === index

          return (
            <motion.div
              key={step.id}
              className="relative"
              {...slideUp}
              transition={{ delay: index * 0.1 }}
            >
              {index < CHAIN_STEPS.length - 1 && (
                <motion.div
                  className="absolute left-[27px] top-14 h-3 w-0.5 bg-border/40"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: isCompleted ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{ transformOrigin: "top" }}
                />
              )}

              <div className="flex gap-4">
                <div className="relative z-10">
                  <motion.div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 transition-colors ${isCompleted
                        ? "bg-success/10 border-success/30"
                        : isCurrent
                          ? "bg-primary/10 border-primary/30"
                          : "bg-muted/30 border-border/30"
                      }`}
                    animate={isCurrent ? { scale: [1, 1.03, 1] } : {}}
                    transition={{ duration: 2, repeat: isCurrent ? Infinity : 0, ease: "easeInOut" }}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 text-success" />
                    ) : isCurrent ? (
                      <motion.div
                        className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
                        animate={spin}
                      />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </motion.div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${methodStyle(step.method)}`}>
                      {step.method}
                    </span>
                    <code className="text-sm font-mono text-muted-foreground truncate">
                      {step.url.replace(/\{\{[\w]+\}\}/g, (match) =>
                        isCompleted && step.extractValue ? step.extractValue : match
                      )}
                    </code>
                  </div>

                  <p className="text-xs text-muted-foreground mb-2">{step.description}</p>

                  <AnimatePresence>
                    {(isCompleted || isCurrent) && (
                      <motion.div
                        {...collapse}
                        transition={{ duration: 0.2 }}
                        className="p-3 rounded-lg bg-background/60 border border-border/40"
                      >
                        <div className="font-mono text-xs">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-bold ${isCompleted ? "text-success" : "text-muted-foreground"}`}>
                              {isCompleted ? "200 OK" : "Loading..."}
                            </span>
                            {isCompleted && <span className="text-muted-foreground/60 text-[10px]">~25ms</span>}
                          </div>
                          {!isCompleted ? (
                            <div className="flex gap-1">
                              {[0, 1, 2].map(i => (
                                <motion.div
                                  key={i}
                                  className="w-1 h-1 bg-muted-foreground/50 rounded-full"
                                  animate={{ opacity: [0.3, 1, 0.3] }}
                                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-0.5 text-muted-foreground text-[10px]">
                              <span className="text-syntax-punctuation">{"{"}</span>
                              {Object.entries(step.response).slice(0, 2).map(([key, value]) => (
                                <div key={key} className="pl-3">
                                  <span className="text-syntax-key">"{key}"</span>:{" "}
                                  <span className="text-syntax-string">{previewValue(value)}</span>
                                </div>
                              ))}
                              <span className="text-syntax-punctuation">{"}"}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )
        })}

        <AnimatePresence>
          {completedSteps.length === CHAIN_STEPS.length && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="p-4 rounded-xl bg-success/10 border border-success/20"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-success" />
                <div>
                  <p className="text-sm font-semibold text-success">Chain Complete</p>
                  <p className="text-xs text-muted-foreground">
                    {CHAIN_STEPS.length} requests executed • 2 values extracted
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ShowcaseFooter tag="JSONPath" tagClassName="bg-primary/10 text-primary">
        <span>Use</span>
        <code className="px-1.5 py-0.5 rounded bg-muted/50 font-mono text-syntax-number text-[10px]">
          $.data[0].id
        </code>
        <span>to extract values</span>
      </ShowcaseFooter>
    </div>
  )
}
