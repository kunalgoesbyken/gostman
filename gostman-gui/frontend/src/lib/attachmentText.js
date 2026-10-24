const PROXY_LIMIT = '4.5 MB'
const DESKTOP_LIMIT = '1 GB'

export const ATTACHMENT_TEXT = {
  choose: 'Choose file',
  replace: 'Replace',
  none: 'No file selected',
  pickTitle: 'Choose a file to send',
  fromDisk: (path) => `Read from ${path} when the request is sent`,
  tooLarge: (name, size, limit) => `${name} is ${size}. The web app sends files up to ${limit}, because its hosted proxy accepts requests of at most ${PROXY_LIMIT}. The desktop app sends files up to ${DESKTOP_LIMIT} straight from disk.`,
  proxyTooLarge: `The request is larger than the ${PROXY_LIMIT} the web app can pass through its proxy. Send large bodies and files from the desktop app or the CLI.`,
}
