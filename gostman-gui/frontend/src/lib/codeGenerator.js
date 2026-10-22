const CONTENT_TYPE = 'content-type'
const BARE_SHELL_WORD = /^[A-Za-z0-9_-]+$/

const FIRST_PRINTABLE = 0x20
const C_ESCAPES = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t' }

const quote = (text) => JSON.stringify(text)

const shellQuote = (text) => `'${text.replaceAll("'", `'\\''`)}'`

const shellWord = (text) => (BARE_SHELL_WORD.test(text) ? text : shellQuote(text))

const singleQuote = (text) => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`

const POWERSHELL_QUOTES = new Set(["'", '‘', '’', '‚', '‛'])

const powershellQuote = (text) => `'${Array.from(text, (character) => (POWERSHELL_QUOTES.has(character) ? character + character : character)).join('')}'`

const fourDigitEscape = (code) => `\\u${code.toString(16).padStart(4, '0')}`

const bracedEscape = (code) => `\\u{${code.toString(16)}}`

function doubleQuoteWith(controlEscape, extraEscapes = {}) {
  const escapes = { ...C_ESCAPES, ...extraEscapes }
  return (text) => {
    let quoted = '"'
    for (const character of text) {
      const code = character.codePointAt(0)
      quoted += escapes[character] ?? (code < FIRST_PRINTABLE ? controlEscape(code) : character)
    }
    return `${quoted}"`
  }
}

const csharpQuote = doubleQuoteWith(fourDigitEscape)
const kotlinQuote = doubleQuoteWith(fourDigitEscape, { $: '\\$' })
const swiftQuote = doubleQuoteWith(bracedEscape)
const rustQuote = doubleQuoteWith(bracedEscape)
const dartQuote = doubleQuoteWith(bracedEscape, { $: '\\$' })

const isContentHeader = ({ key }) => key.toLowerCase().startsWith('content-')

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
    `curl_setopt($ch, CURLOPT_URL, ${singleQuote(url)});`,
    `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${singleQuote(method)});`,
    'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
  ]
  if (headerLines.length > 0) {
    options.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [', ...headerLines.map((line) => `    ${singleQuote(line)},`), ']);')
  }
  if (body) options.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${singleQuote(body)});`)
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

function generateCSharp({ method, url, headers, body }) {
  const contentLines = body
    ? [
        `request.Content = new ByteArrayContent(Encoding.UTF8.GetBytes(${csharpQuote(body)}));`,
        ...headers.filter(isContentHeader).map(({ key, value }) => `request.Content.Headers.TryAddWithoutValidation(${csharpQuote(key)}, ${csharpQuote(value)});`),
      ]
    : []
  const requestHeaders = body ? headers.filter((header) => !isContentHeader(header)) : headers
  return [
    'using System.Text;',
    '',
    'using var client = new HttpClient();',
    `using var request = new HttpRequestMessage(new HttpMethod(${csharpQuote(method)}), ${csharpQuote(url)});`,
    ...contentLines,
    ...requestHeaders.map(({ key, value }) => `request.Headers.TryAddWithoutValidation(${csharpQuote(key)}, ${csharpQuote(value)});`),
    '',
    'using var response = await client.SendAsync(request);',
    'Console.WriteLine((int)response.StatusCode);',
    'Console.WriteLine(await response.Content.ReadAsStringAsync());',
  ].join('\n')
}

function generateRuby({ method, url, headers, body }) {
  const expectsBody = method !== 'HEAD'
  return [
    "require 'net/http'",
    "require 'uri'",
    '',
    `uri = URI(${singleQuote(url)})`,
    'http = Net::HTTP.new(uri.host, uri.port)',
    "http.use_ssl = uri.scheme == 'https'",
    '',
    `request = Net::HTTPGenericRequest.new(${singleQuote(method)}, ${Boolean(body)}, ${expectsBody}, uri.request_uri)`,
    ...headers.map(({ key, value }) => `request.add_field(${singleQuote(key)}, ${singleQuote(value)})`),
    ...(body ? [`request.body = ${singleQuote(body)}`] : []),
    '',
    'response = http.request(request)',
    'puts response.code',
    'puts response.body',
  ].join('\n')
}

function generateSwift({ method, url, headers, body }) {
  return [
    'import Foundation',
    '',
    `var request = URLRequest(url: URL(string: ${swiftQuote(url)})!)`,
    `request.httpMethod = ${swiftQuote(method)}`,
    ...headers.map(({ key, value }) => `request.addValue(${swiftQuote(value)}, forHTTPHeaderField: ${swiftQuote(key)})`),
    ...(body ? [`request.httpBody = ${swiftQuote(body)}.data(using: .utf8)`] : []),
    '',
    'let (data, response) = try await URLSession.shared.data(for: request)',
    'print((response as! HTTPURLResponse).statusCode)',
    'print(String(decoding: data, as: UTF8.self))',
  ].join('\n')
}

function generateKotlin({ method, url, headers, body }) {
  const publisher = body
    ? `HttpRequest.BodyPublishers.ofString(${kotlinQuote(body)})`
    : 'HttpRequest.BodyPublishers.noBody()'
  return [
    'import java.net.URI',
    'import java.net.http.HttpClient',
    'import java.net.http.HttpRequest',
    'import java.net.http.HttpResponse',
    '',
    'fun main() {',
    '    val client = HttpClient.newHttpClient()',
    '    val request = HttpRequest.newBuilder()',
    `        .uri(URI.create(${kotlinQuote(url)}))`,
    ...headers.map(({ key, value }) => `        .header(${kotlinQuote(key)}, ${kotlinQuote(value)})`),
    `        .method(${kotlinQuote(method)}, ${publisher})`,
    '        .build()',
    '',
    '    val response = client.send(request, HttpResponse.BodyHandlers.ofString())',
    '    println(response.statusCode())',
    '    println(response.body())',
    '}',
  ].join('\n')
}

function generateRust({ method, url, headers, body }) {
  return [
    'fn main() -> Result<(), Box<dyn std::error::Error>> {',
    '    let client = reqwest::blocking::Client::new();',
    '    let response = client',
    `        .request(reqwest::Method::from_bytes(${rustQuote(method)}.as_bytes())?, ${rustQuote(url)})`,
    ...headers.map(({ key, value }) => `        .header(${rustQuote(key)}, ${rustQuote(value)})`),
    ...(body ? [`        .body(${rustQuote(body)})`] : []),
    '        .send()?;',
    '',
    '    println!("{}", response.status());',
    '    println!("{}", response.text()?);',
    '    Ok(())',
    '}',
  ].join('\n')
}

function generateDart({ method, url, headers, body }) {
  const merged = mergeRepeatedHeaders(headers)
  return [
    ...(body ? ["import 'dart:convert';", ''] : []),
    "import 'package:http/http.dart' as http;",
    '',
    'Future<void> main() async {',
    `  final request = http.Request(${dartQuote(method)}, Uri.parse(${dartQuote(url)}));`,
    ...(merged.length > 0
      ? ['  request.headers.addAll({', ...merged.map(({ key, value }) => `    ${dartQuote(key)}: ${dartQuote(value)},`), '  });']
      : []),
    ...(body ? [`  request.bodyBytes = utf8.encode(${dartQuote(body)});`] : []),
    '',
    '  final response = await http.Response.fromStream(await request.send());',
    '  print(response.statusCode);',
    '  print(response.body);',
    '}',
  ].join('\n')
}

function generatePowerShell({ method, url, headers, body }) {
  const merged = mergeRepeatedHeaders(headers)
  const contentType = merged.find(({ key }) => key.toLowerCase() === CONTENT_TYPE)
  const others = merged.filter((header) => header !== contentType)
  const lines = []
  const call = [`-Uri ${powershellQuote(url)}`, `-Method ${powershellQuote(method)}`, '-UseBasicParsing']
  if (others.length > 0) {
    lines.push('$headers = @{', ...others.map(({ key, value }) => `    ${powershellQuote(key)} = ${powershellQuote(value)}`), '}')
    call.push('-Headers $headers')
  }
  if (contentType) call.push(`-ContentType ${powershellQuote(contentType.value)}`)
  if (body) {
    lines.push(`$body = [System.Text.Encoding]::UTF8.GetBytes(${powershellQuote(body)})`)
    call.push('-Body $body')
  }
  return [
    ...lines,
    ...(lines.length > 0 ? [''] : []),
    `$response = Invoke-WebRequest ${call.join(' ')}`,
    '$response.StatusCode',
    '$response.Content',
  ].join('\n')
}

export const SNIPPET_LANGUAGES = [
  { id: 'curl', label: 'cURL', generate: generateCurl },
  { id: 'javascript', label: 'JavaScript', generate: generateJavaScript },
  { id: 'python', label: 'Python', generate: generatePython },
  { id: 'go', label: 'Go', generate: generateGo },
  { id: 'java', label: 'Java', generate: generateJava },
  { id: 'kotlin', label: 'Kotlin', generate: generateKotlin },
  { id: 'csharp', label: 'C#', generate: generateCSharp },
  { id: 'php', label: 'PHP', generate: generatePhp },
  { id: 'ruby', label: 'Ruby', generate: generateRuby },
  { id: 'swift', label: 'Swift', generate: generateSwift },
  { id: 'rust', label: 'Rust', generate: generateRust },
  { id: 'dart', label: 'Dart', generate: generateDart },
  { id: 'powershell', label: 'PowerShell', generate: generatePowerShell },
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
