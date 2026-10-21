import { TakeOpenLinks } from '../../../wailsjs/go/main/App'
import { EventsOn } from '../../../wailsjs/runtime/runtime'
import { receiveOpenAddress, receiveOpenLink } from '../openLink'

const RECEIVED_EVENT = 'openlink:received'

const receive = (link) => (link.error ? receiveOpenLink({ error: link.error }) : receiveOpenAddress(link.url))

async function takePending() {
  const links = await TakeOpenLinks()
  if (links) links.forEach(receive)
}

export function watchDesktopLinks() {
  EventsOn(RECEIVED_EVENT, takePending)
  takePending()
}
