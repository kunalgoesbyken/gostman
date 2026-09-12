import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Braces, Play } from "lucide-react"
import { fadeIn, popIn } from "../../../lib/motion"
import { EmptyState, PanelLabel, ShowcaseFooter, ShowcaseHeader, ShowcasePanel, Spinner } from "../ShowcaseParts"
import { useDemoSequence } from "../useDemoSequence"

const GRAPHQL_RESPONSE = {
  data: {
    user: {
      id: "101",
      username: "gopher_fan",
      email: "gopher@example.com",
      profile: {
        avatar: "https://avatar.example.com/gopher.jpg",
        bio: "Go enthusiast | API builder",
        location: "San Francisco, CA",
      },
      repositories: {
        edges: [
          {
            node: { name: "gostman", description: "Lightweight HTTP client", stars: 1234 },
          },
          {
            node: { name: "go-api-tools", description: "API development toolkit", stars: 567 },
          },
        ],
      },
    },
  },
}

const DEMO_SEQUENCE = [
  { delay: 0, action: "reset" },
  { delay: 1500, action: "execute" },
  { delay: 2500, action: "showResponse" },
]

const QueryValue = ({ value }) => {
  if (typeof value === "string") {
    return (
      <span className="text-emerald-300">"{value.slice(0, 40)}{value.length > 40 ? "..." : ""}"</span>
    )
  }
  if (Array.isArray(value)) {
    return (
      <>
        <span className="text-amber-300">[</span>
        <span className="text-muted-foreground/50">...{value.length} items</span>
        <span className="text-amber-300">]</span>
      </>
    )
  }
  if (typeof value === "object") return <span className="text-amber-300">{"{...}"}</span>
  return <span className="text-purple-300">{value}</span>
}

const renderJSON = (obj, depth = 0) => {
  if (typeof obj !== "object" || obj === null) {
    return <span className="text-emerald-300">"{obj}"</span>
  }

  return (
    <div className="space-y-0.5">
      <span className="text-amber-300">{"{"}</span>
      {Object.entries(obj).slice(0, depth === 0 ? 3 : 2).map(([key, value], i, arr) => (
        <div key={key} className="pl-4">
          <span className="text-blue-300">"{key}"</span>:{" "}
          <QueryValue value={value} />
          {i < arr.length - 1 && ","}
        </div>
      ))}
      <span className="text-amber-300">{"}"}</span>
    </div>
  )
}

const QueryField = ({ name }) => <div className="text-blue-300">{name}</div>

export const GraphQLShowcase = () => {
  const [isExecuting, setIsExecuting] = useState(false)
  const [showResponse, setShowResponse] = useState(false)

  useDemoSequence({
    steps: DEMO_SEQUENCE,
    loopAfter: 5000,
    reset: () => {
      setIsExecuting(false)
      setShowResponse(false)
    },
    onStep: ({ action }) => {
      if (action === "reset") {
        setIsExecuting(false)
        setShowResponse(false)
      } else if (action === "execute") {
        setIsExecuting(true)
      } else if (action === "showResponse") {
        setIsExecuting(false)
        setShowResponse(true)
      }
    },
  })

  const status = isExecuting
    ? "Executing..."
    : showResponse
      ? "View structured response"
      : "Write your query"

  return (
    <div className="w-full h-full flex flex-col">
      <ShowcaseHeader
        icon={Braces}
        iconClassName="text-pink-400"
        tint="bg-pink-500/10"
        title="GraphQL Request"
        subtitle={status}
      >
        <motion.button
          className={`px-4 py-2 rounded-md font-semibold text-sm flex items-center gap-2 ${isExecuting
              ? "bg-muted text-muted-foreground"
              : "bg-pink-500/10 text-pink-400"
            }`}
          animate={isExecuting ? { scale: [1, 0.98, 1] } : {}}
          transition={{ duration: 1, repeat: isExecuting ? Infinity : 0 }}
        >
          {isExecuting ? (
            <>
              <Spinner className="w-4 h-4" />
              Running
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Query
            </>
          )}
        </motion.button>
      </ShowcaseHeader>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        <ShowcasePanel from="left">
          <div className="px-4 py-2 border-b border-border/40 bg-muted/20">
            <PanelLabel>Query</PanelLabel>
          </div>

          <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
            <div className="space-y-1 text-muted-foreground">
              <div>
                <span className="text-purple-400">query</span>{" "}
                <span className="text-blue-400">GetUserProfile</span>(
                <span className="text-amber-400">$username</span>:{" "}
                <span className="text-cyan-400">String!</span>) {"{"}
              </div>
              <div className="pl-4">
                <span className="text-blue-400">user</span>(username: <span className="text-amber-400">$username</span>) {"{"}
              </div>
              <div className="pl-8 space-y-0.5">
                {["id", "username", "email"].map((field) => (
                  <QueryField key={field} name={field} />
                ))}
                <div className="text-blue-300 space-y-0.5">
                  <div>profile {"{"}</div>
                  <div className="pl-4 space-y-0.5">
                    {["avatar", "bio", "location"].map((field) => (
                      <QueryField key={field} name={field} />
                    ))}
                  </div>
                  <div>{"}"}</div>
                </div>
              </div>
              <div className="pl-4">{"}"}</div>
              <div>{"}"}</div>
            </div>
          </div>
        </ShowcasePanel>

        <ShowcasePanel from="right" delay={0.1}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/20">
            <PanelLabel>Response</PanelLabel>
            <AnimatePresence>
              {showResponse && (
                <motion.span
                  {...popIn}
                  exit={{ scale: 0 }}
                  className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400"
                >
                  200 OK
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 overflow-auto p-4 font-mono text-xs">
            <AnimatePresence mode="wait">
              {!showResponse ? (
                <EmptyState
                  icon={Braces}
                  iconClassName="w-10 h-10"
                  message="Run a query to see the response"
                  className="h-full"
                />
              ) : (
                <motion.div key="response" {...fadeIn} transition={{ duration: 0.3 }}>
                  {renderJSON(GRAPHQL_RESPONSE)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ShowcasePanel>
      </div>

      <ShowcaseFooter tag="No over-fetching" tagClassName="bg-blue-500/10 text-blue-400">
        <span>Get exactly the data you need, nothing more.</span>
      </ShowcaseFooter>
    </div>
  )
}
