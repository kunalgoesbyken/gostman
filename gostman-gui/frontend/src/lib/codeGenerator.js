const CONTENT_TYPE = 'content-type'
const BARE_SHELL_WORD = /^[A-Za-z0-9_-]+$/

const quote = (text) => JSON.stringify(text)

const shellQuote = (text) => `'${text.replaceAll("'", `'\\''`)}'`

const shellWord = (text) => (BARE_SHELL_WORD.test(text) ? text : shellQuote(text))

const phpQuote = (text) => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`

const hasHeader = (headers, name) => headers.some((header) => header.key.toLowerCase() === name)

function curlHeaderLines(headers, body) {
  const lines = headers.map(({ key, value }) => (value === '' ? `${key};` : `${key}: ${value}`))
  return body && !hasHeader(headers, CONTENT_TYPE) ? [...lines, 'Content-Type:'] : lines
}

function generateCurl({ method, url, headers, body }) {
  const methodFlag = method === 'HEAD' ? '--head' : `-X ${shellWord(method)}`
  const parts = [
    `curl ${methodFlag} ${shellQuote(url)}`,
    ...curlHeaderLines(headers, body).map((line) => `-H ${shellQuote(line)}`),
  ]
  if (body) parts.push(`--data-raw ${shellQuote(body)}`)
  return parts.join(' \\\n  ')
}

function generateJavaScript({ method, url, headers, body }) {
  const options = [`  method: ${quote(method)},`]
  if (headers.length > 0) {
    const pairs = headers.map(({ key, value }) => `    [${quote(key)}, ${quote(value)}],`)
    options.push('  headers: [', ...pairs, '  ],')
  }
  if (body) options.push(`  body: ${quote(body)},`)
  return [
    `fetch(${quote(url)}, {`,
    ...options,
    '})',
    '  .then((response) => response.text())',
    '  .then((text) => console.log(text))',
    '  .catch((error) => console.error(error))',
  ].join('\n')
}

function mergeRepeatedHeaders(headers) {
  const merged = new Map()
  for (const { key, value } of headers) {
    const name = key.toLowerCase()
    const existing = merged.get(name)
    merged.set(name, existing ? { key: existing.key, value: `${existing.value}, ${value}` } : { key, value })
  }
  return Array.from(merged.values())
}

function generatePython({ method, url, headers, body }) {
  const lines = ['import requests', '', `url = ${quote(url)}`]
  const call = [quote(method), 'url']
  if (headers.length > 0) {
    const entries = mergeRepeatedHeaders(headers).map(({ key, value }) => `    ${quote(key)}: ${quote(value)},`)
    lines.push('headers = {', ...entries, '}')
    call.push('headers=headers')
  }
  if (body) {
    lines.push(`data = ${quote(body)}.encode("utf-8")`)
    call.push('data=data')
  }
  return [
    ...lines,
    '',
    `response = requests.request(${call.join(', ')})`,
    '',
    'print(response.status_code)',
    'print(response.text)',
  ].join('\n')
}

function generateGo({ method, url, headers, body }) {
  const imports = ['"fmt"', '"io"', '"net/http"', ...(body ? ['"strings"'] : [])]
  const reader = body ? `strings.NewReader(${quote(body)})` : 'nil'
  return [
    'package main',
    '',
    'import (',
    ...imports.map((name) => `\t${name}`),
    ')',
    '',
    'func main() {',
    `\treq, err := http.NewRequest(${quote(method)}, ${quote(url)}, ${reader})`,
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    ...headers.map(({ key, value }) => `\treq.Header.Add(${quote(key)}, ${quote(value)})`),
    '',
    '\tresp, err := http.DefaultClient.Do(req)',
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    '\tdefer resp.Body.Close()',
    '',
    '\tresponseBody, err := io.ReadAll(resp.Body)',
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    '\tfmt.Println(resp.Status)',
    '\tfmt.Println(string(responseBody))',
    '}',
  ].join('\n')
}

function generatePhp({ method, url, headers, body }) {
  const headerLines = curlHeaderLines(headers, body)
  const options = [
    `curl_setopt($ch, CURLOPT_URL, ${phpQuote(url)});`,
    `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpQuote(method)});`,
    'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
  ]
  if (headerLines.length > 0) {
    options.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [', ...headerLines.map((line) => `    ${phpQuote(line)},`), ']);')
  }
  if (body) options.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpQuote(body)});`)
  return [
    '<?php',
    '',
    '$ch = curl_init();',
    '',
    ...options,
    '',
    '$response = curl_exec($ch);',
    '$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);',
    'curl_close($ch);',
    '',
    'echo $statusCode . PHP_EOL;',
    'echo $response . PHP_EOL;',
  ].join('\n')
}

function generateJava({ method, url, headers, body }) {
  const publisher = body
    ? `HttpRequest.BodyPublishers.ofString(${quote(body)})`
    : 'HttpRequest.BodyPublishers.noBody()'
  return [
    'import java.net.URI;',
    'import java.net.http.HttpClient;',
    'import java.net.http.HttpRequest;',
    'import java.net.http.HttpResponse;',
    '',
    'public class Main {',
    '    public static void main(String[] args) throws Exception {',
    '        HttpClient client = HttpClient.newHttpClient();',
    '',
    '        HttpRequest request = HttpRequest.newBuilder()',
    `            .uri(URI.create(${quote(url)}))`,
    ...headers.map(({ key, value }) => `            .header(${quote(key)}, ${quote(value)})`),
    `            .method(${quote(method)}, ${publisher})`,
    '            .build();',
    '',
    '        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
    '',
    '        System.out.println(response.statusCode());',
    '        System.out.println(response.body());',
    '    }',
    '}',
  ].join('\n')
}

export const SNIPPET_LANGUAGES = [
  { id: 'curl', label: 'cURL', generate: generateCurl },
  { id: 'javascript', label: 'JavaScript', generate: generateJavaScript },
  { id: 'python', label: 'Python', generate: generatePython },
  { id: 'go', label: 'Go', generate: generateGo },
  { id: 'php', label: 'PHP', generate: generatePhp },
  { id: 'java', label: 'Java', generate: generateJava },
]

export function generateAllSnippets(prepared) {
  const request = {
    method: prepared.method,
    url: prepared.url,
    headers: prepared.headers || [],
    body: prepared.body || '',
  }
  return Object.fromEntries(SNIPPET_LANGUAGES.map(({ id, generate }) => [id, generate(request)]))
}
