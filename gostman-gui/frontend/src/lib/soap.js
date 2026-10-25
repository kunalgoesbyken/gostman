import { isSentRow, parseRows, serializeRows } from './rows'

export const SOAP_11 = '1.1'
const SOAP_12 = '1.2'

export const SOAP_VERSIONS = [
  { value: SOAP_11, label: 'SOAP 1.1' },
  { value: SOAP_12, label: 'SOAP 1.2' },
]


const NAMESPACES = {
  [SOAP_11]: 'http://schemas.xmlsoap.org/soap/envelope/',
  [SOAP_12]: 'http://www.w3.org/2003/05/soap-envelope',
}

const ACTION_HEADER = 'SOAPAction'
const ENVELOPE = 'Envelope'
const BODY = 'Body'
const FAULT = 'Fault'
const INDENT = '  '
const DECLARATION_START = '<?xml'
const DECLARATION_END = '?>'
const PARSER_ERROR = 'parsererror'
const FAILURE_DETAIL = 'div'
const XML_TYPE = 'application/xml'

const ELEMENT = 1
const TEXT = 3
const CDATA = 4
const PROCESSING_INSTRUCTION = 7
const COMMENT = 8

export const soapTemplate = (version) => [
  `<?xml version="1.0" encoding="utf-8"?>`,
  `<soap:Envelope xmlns:soap="${NAMESPACES[version]}">`,
  `${INDENT}<soap:Header/>`,
  `${INDENT}<soap:Body>`,
  `${INDENT}${INDENT}`,
  `${INDENT}</soap:Body>`,
  `</soap:Envelope>`,
  ``,
].join('\n')

export const detectSoapVersion = (text) => (
  [SOAP_11, SOAP_12].find((version) => text.includes(NAMESPACES[version])) || ''
)

export function switchSoapVersion(text, version) {
  const current = detectSoapVersion(text)
  if (current === '') return soapTemplate(version)
  return text.replaceAll(NAMESPACES[current], NAMESPACES[version])
}

const isAction = (row) => row.key.trim().toLowerCase() === ACTION_HEADER.toLowerCase()

export const readSoapAction = (headers) => parseRows(headers).find((row) => isSentRow(row) && isAction(row))?.value || ''

export function writeSoapAction(headers, action) {
  const others = parseRows(headers).filter((row) => !isAction(row))
  if (action === '') return serializeRows(others)
  return serializeRows([...others, { key: ACTION_HEADER, value: action, enabled: true }])
}

const failureText = (failure) => (failure.querySelector(FAILURE_DETAIL) ?? failure).textContent.trim().split('\n')[0]

function parseXml(text) {
  const document = new DOMParser().parseFromString(text, XML_TYPE)
  const failure = document.getElementsByTagName(PARSER_ERROR)[0]
  return failure ? { error: failureText(failure) } : { document }
}

const escapeText = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const escapeAttribute = (text) => escapeText(text).replaceAll('"', '&quot;')

const openingTag = (element, close) => {
  const attributes = Array.from(element.attributes, (attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`)
  return `<${element.nodeName}${attributes.join('')}${close}>`
}

const isContent = (node) => node.nodeType !== TEXT || node.nodeValue.trim() !== ''

const isCharacterData = (node) => node.nodeType === TEXT || node.nodeType === CDATA

const characterText = (node) => (node.nodeType === CDATA ? `<![CDATA[${node.nodeValue}]]>` : escapeText(node.nodeValue.trim()))

function nodeLines(node, depth) {
  const pad = INDENT.repeat(depth)
  if (node.nodeType === TEXT) return [`${pad}${escapeText(node.nodeValue.trim())}`]
  if (node.nodeType === CDATA) return [`${pad}${characterText(node)}`]
  if (node.nodeType === COMMENT) return [`${pad}<!--${node.nodeValue}-->`]
  if (node.nodeType === PROCESSING_INSTRUCTION) return [`${pad}<?${node.target} ${node.data}?>`]
  if (node.nodeType !== ELEMENT) return []
  const children = Array.from(node.childNodes).filter(isContent)
  if (children.length === 0) return [`${pad}${openingTag(node, '/')}`]
  if (children.every(isCharacterData)) {
    return [`${pad}${openingTag(node, '')}${children.map(characterText).join('')}</${node.nodeName}>`]
  }
  return [
    `${pad}${openingTag(node, '')}`,
    ...children.flatMap((child) => nodeLines(child, depth + 1)),
    `${pad}</${node.nodeName}>`,
  ]
}

function declarationOf(text) {
  const trimmed = text.trimStart()
  if (!trimmed.startsWith(DECLARATION_START)) return []
  const end = trimmed.indexOf(DECLARATION_END)
  return end === -1 ? [] : [trimmed.slice(0, end + DECLARATION_END.length)]
}

function render(document, text) {
  const body = Array.from(document.childNodes).flatMap((node) => nodeLines(node, 0))
  return [...declarationOf(text), ...body].join('\n')
}

export function formatXml(text) {
  const parsed = parseXml(text)
  return parsed.error ? { error: parsed.error } : { text: render(parsed.document, text) }
}

const childElements = (node) => Array.from(node.children)

const findChild = (node, name) => childElements(node).find((child) => child.localName === name)

const textOf = (node, name) => findChild(node, name)?.textContent.trim() || ''

function detailText(detail) {
  if (!detail) return ''
  return Array.from(detail.childNodes).filter(isContent).flatMap((node) => nodeLines(node, 0)).join('\n')
}

function readFault11(fault) {
  return {
    code: textOf(fault, 'faultcode'),
    reason: textOf(fault, 'faultstring'),
    actor: textOf(fault, 'faultactor'),
    detail: detailText(findChild(fault, 'detail')),
  }
}

function readFault12(fault) {
  const code = findChild(fault, 'Code')
  const subcode = code && findChild(code, 'Subcode')
  const codeText = [code && textOf(code, 'Value'), subcode && textOf(subcode, 'Value')].filter(Boolean).join(' / ')
  const reason = findChild(fault, 'Reason')
  return {
    code: codeText,
    reason: reason ? textOf(reason, 'Text') : '',
    actor: textOf(fault, 'Role') || textOf(fault, 'Node'),
    detail: detailText(findChild(fault, 'Detail')),
  }
}

export function readSoapResponse(text) {
  if (!text.includes(ENVELOPE)) return null
  const parsed = parseXml(text)
  if (parsed.error) return null
  const root = parsed.document.documentElement
  const version = [SOAP_11, SOAP_12].find((candidate) => NAMESPACES[candidate] === root.namespaceURI)
  if (root.localName !== ENVELOPE || !version) return null
  const body = findChild(root, BODY)
  const fault = body && findChild(body, FAULT)
  const readFault = version === SOAP_11 ? readFault11 : readFault12
  return { version, formatted: render(parsed.document, text), fault: fault ? readFault(fault) : null }
}
