import { useMemo } from "react"
import { McpNotifications } from "./McpNotifications"
import { SoapBody } from "./SoapBody"
import { SseView } from "./SseView"
import { LARGE_BODY_CHARS } from "../lib/largeText"
import { readSoapResponse } from "../lib/soap"
import { selectSession, useSseStore } from "../lib/sseSessions"
import { useAppStore } from "../store/appStore"

const XML_TYPES = ["text/xml", "application/xml", "application/soap+xml"]

const selectPendingId = (state) => state.tabs.find((tab) => tab.id === state.activeTabId)?.pendingId

function useStreamId(isLoading, response) {
  const pendingId = useAppStore(selectPendingId)
  const streamId = isLoading ? pendingId : response?.streamId
  const hasSession = useSseStore((state) => Boolean(streamId) && Boolean(selectSession(streamId)(state)))
  return hasSession ? streamId : null
}

function useSoap(response) {
  const isXml = Boolean(response) && !response.error && XML_TYPES.includes(response.contentType) && response.body.length <= LARGE_BODY_CHARS
  return useMemo(() => (isXml ? readSoapResponse(response.body) : null), [isXml, response])
}

export function ProtocolBody({ response, isLoading, isBodyShown, children }) {
  const streamId = useStreamId(isLoading, response)
  const soap = useSoap(isLoading ? null : response)
  if (streamId && (isLoading || isBodyShown)) return <SseView streamId={streamId} />
  if (soap && isBodyShown) return <SoapBody soap={soap} />
  if (isBodyShown && !isLoading && response?.notifications?.length > 0) {
    return (
      <>
        <McpNotifications notifications={response.notifications} />
        {children}
      </>
    )
  }
  return children
}
