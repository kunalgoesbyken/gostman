import { readStored, writeStored } from './storage'
import { DEFAULT_PART_TYPE, formContentType, formSegments, isContentType, uploadOf } from './uploadParts'

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

const hasFilePart = (parts) => Boolean(parts?.some((part) => part.file !== undefined))

const readsFiles = ({ file, parts }) => Boolean(file) || hasFilePart(parts)

const sendsBody = ({ body, file, parts }) => Boolean(body) || Boolean(file) || Boolean(parts)

const withFormType = (headers) => [...headers, { key: 'Content-Type', value: formContentType() }]

const hasHeader = (headers, name) => headers.some((header) => header.key.toLowerCase() === name)

function curlHeaderLines(headers, body) {
  const lines = headers.map(({ key, value }) => (value === '' ? `${key};` : `${key}: ${value}`))
  return body && !hasHeader(headers, CONTENT_TYPE) ? [...lines, 'Content-Type:'] : lines
}

const curlFileName = (file) => `"${file.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

const curlPartType = ({ contentType }) => (contentType === DEFAULT_PART_TYPE ? '' : `;type=${contentType}`)

function curlPart(part) {
  if (part.file === undefined) return `--form-string ${shellQuote(`${part.name}=${part.value}`)}`
  return `-F ${shellQuote(`${part.name}=@${curlFileName(part.file)}${curlPartType(part)}`)}`
}

function curlBody({ body, file, parts }) {
  if (file) return [`--data-binary ${shellQuote(`@${file}`)}`]
  if (parts) return parts.map(curlPart)
  return body ? [`--data-raw ${shellQuote(body)}`] : []
}

function generateCurl(request) {
  const { method, url, headers, body } = request
  const methodFlag = method === 'HEAD' ? '--head' : `-X ${shellWord(method)}`
  return [
    `curl ${methodFlag} ${shellQuote(url)}`,
    ...curlHeaderLines(headers, body).map((line) => `-H ${shellQuote(line)}`),
    ...curlBody(request),
  ].join(' \\\n  ')
}

const blobOf = (file, contentType) => `await openAsBlob(${quote(file)}${contentType ? `, { type: ${quote(contentType)} }` : ''})`

function javaScriptForm(parts) {
  const appends = parts.map((part) => (part.file === undefined
    ? `form.append(${quote(part.name)}, ${quote(part.value)})`
    : `form.append(${quote(part.name)}, ${blobOf(part.file, part.contentType)}, ${quote(part.file)})`))
  return ['const form = new FormData()', ...appends, '']
}

function javaScriptBody({ body, file, parts }) {
  if (file) return blobOf(file)
  if (parts) return 'form'
  return body ? quote(body) : ''
}

function generateJavaScript(request) {
  const { url, headers, parts } = request
  const options = [`  method: ${quote(request.method)},`]
  if (headers.length > 0) {
    const pairs = headers.map(({ key, value }) => `    [${quote(key)}, ${quote(value)}],`)
    options.push('  headers: [', ...pairs, '  ],')
  }
  const body = javaScriptBody(request)
  if (body) options.push(`  body: ${body},`)
  return [
    ...(readsFiles(request) ? ['import { openAsBlob } from "node:fs"', ''] : []),
    ...(parts ? javaScriptForm(parts) : []),
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

const pythonPart = (part) => (part.file === undefined
  ? `    (${quote(part.name)}, (None, ${quote(part.value)})),`
  : `    (${quote(part.name)}, (${quote(part.file)}, open(${quote(part.file)}, "rb"), ${quote(part.contentType)})),`)

function generatePython({ method, url, headers, body, file, parts }) {
  const lines = ['import requests', '', `url = ${quote(url)}`]
  const call = [quote(method), 'url']
  if (headers.length > 0) {
    const entries = mergeRepeatedHeaders(headers).map(({ key, value }) => `    ${quote(key)}: ${quote(value)},`)
    lines.push('headers = {', ...entries, '}')
    call.push('headers=headers')
  }
  if (parts) {
    lines.push('files = [', ...parts.map(pythonPart), ']')
    call.push('files=files')
  } else if (file) {
    lines.push(`data = open(${quote(file)}, "rb")`)
    call.push('data=data')
  } else if (body) {
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

const GO_PANIC = ['\tif err != nil {', '\t\tpanic(err)', '\t}']

const GO_ADD_FILE = [
  '',
  'func addFile(form *multipart.Writer, field, path string) {',
  '\tpart, err := form.CreateFormFile(field, path)',
  ...GO_PANIC,
  '\tdata, err := os.ReadFile(path)',
  ...GO_PANIC,
  '\tif _, err := part.Write(data); err != nil {',
  '\t\tpanic(err)',
  '\t}',
  '}',
]

const goPart = (part) => (part.file === undefined
  ? `\tform.WriteField(${quote(part.name)}, ${quote(part.value)})`
  : `\taddFile(form, ${quote(part.name)}, ${quote(part.file)})`)

function goBody({ body, file, parts }) {
  if (parts) {
    const setup = ['\tvar body bytes.Buffer', '\tform := multipart.NewWriter(&body)', ...parts.map(goPart), '\tform.Close()', '']
    return { imports: ['"bytes"', '"mime/multipart"', ...(hasFilePart(parts) ? ['"os"'] : [])], setup, reader: '&body' }
  }
  if (file) return { imports: ['"os"'], setup: [`\tfile, err := os.Open(${quote(file)})`, ...GO_PANIC, '\tdefer file.Close()', ''], reader: 'file' }
  if (body) return { imports: ['"strings"'], setup: [], reader: `strings.NewReader(${quote(body)})` }
  return { imports: [], setup: [], reader: 'nil' }
}

function generateGo(request) {
  const { method, url, headers, parts } = request
  const sent = goBody(request)
  const imports = ['"fmt"', '"io"', '"net/http"', ...sent.imports].sort()
  return [
    'package main',
    '',
    'import (',
    ...imports.map((name) => `\t${name}`),
    ')',
    '',
    'func main() {',
    ...sent.setup,
    `\treq, err := http.NewRequest(${quote(method)}, ${quote(url)}, ${sent.reader})`,
    ...GO_PANIC,
    ...headers.map(({ key, value }) => `\treq.Header.Add(${quote(key)}, ${quote(value)})`),
    ...(parts ? ['\treq.Header.Set("Content-Type", form.FormDataContentType())'] : []),
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
    ...(hasFilePart(parts) ? GO_ADD_FILE : []),
  ].join('\n')
}

const phpPart = (part) => (part.file === undefined
  ? `    ${singleQuote(part.name)} => ${singleQuote(part.value)},`
  : `    ${singleQuote(part.name)} => new CURLFile(${singleQuote(part.file)}, ${singleQuote(part.contentType)}, ${singleQuote(part.file)}),`)

function phpFields({ body, file, parts }) {
  if (parts) return ['curl_setopt($ch, CURLOPT_POSTFIELDS, [', ...parts.map(phpPart), ']);']
  if (file) return [`curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents(${singleQuote(file)}));`]
  return body ? [`curl_setopt($ch, CURLOPT_POSTFIELDS, ${singleQuote(body)});`] : []
}

function generatePhp(request) {
  const { method, url, headers, body } = request
  const headerLines = curlHeaderLines(headers, body)
  const options = [
    `curl_setopt($ch, CURLOPT_URL, ${singleQuote(url)});`,
    `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${singleQuote(method)});`,
    'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
  ]
  if (headerLines.length > 0) {
    options.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [', ...headerLines.map((line) => `    ${singleQuote(line)},`), ']);')
  }
  options.push(...phpFields(request))
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

const javaSegment = (segment) => (typeof segment === 'string'
  ? `        form.write(${quote(segment)}.getBytes(StandardCharsets.UTF_8));`
  : `        form.write(Files.readAllBytes(Path.of(${quote(segment.file)})));`)

function javaBody({ body, file, parts }) {
  if (parts) {
    return {
      imports: ['import java.io.ByteArrayOutputStream;', 'import java.nio.charset.StandardCharsets;', 'import java.nio.file.Files;', 'import java.nio.file.Path;'],
      setup: ['        ByteArrayOutputStream form = new ByteArrayOutputStream();', ...formSegments(parts).map(javaSegment), ''],
      publisher: 'HttpRequest.BodyPublishers.ofByteArray(form.toByteArray())',
    }
  }
  if (file) return { imports: ['import java.nio.file.Path;'], setup: [], publisher: `HttpRequest.BodyPublishers.ofFile(Path.of(${quote(file)}))` }
  return { imports: [], setup: [], publisher: body ? `HttpRequest.BodyPublishers.ofString(${quote(body)})` : 'HttpRequest.BodyPublishers.noBody()' }
}

function generateJava(request) {
  const { method, url, parts } = request
  const { imports, setup, publisher } = javaBody(request)
  const headers = parts ? withFormType(request.headers) : request.headers
  return [
    ...imports,
    'import java.net.URI;',
    'import java.net.http.HttpClient;',
    'import java.net.http.HttpRequest;',
    'import java.net.http.HttpResponse;',
    '',
    'public class Main {',
    '    public static void main(String[] args) throws Exception {',
    '        HttpClient client = HttpClient.newHttpClient();',
    '',
    ...setup,
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

const csharpPart = (part) => (part.file === undefined
  ? `form.Add(new StringContent(${csharpQuote(part.value)}), ${csharpQuote(part.name)});`
  : `form.Add(new ByteArrayContent(File.ReadAllBytes(${csharpQuote(part.file)})) { Headers = { ContentType = MediaTypeHeaderValue.Parse(${csharpQuote(part.contentType)}) } }, ${csharpQuote(part.name)}, ${csharpQuote(part.file)});`)

function csharpContent({ body, file, parts }) {
  if (parts) return ['using var form = new MultipartFormDataContent();', ...parts.map(csharpPart), 'request.Content = form;']
  if (file) return [`request.Content = new ByteArrayContent(File.ReadAllBytes(${csharpQuote(file)}));`]
  return [`request.Content = new ByteArrayContent(Encoding.UTF8.GetBytes(${csharpQuote(body)}));`]
}

function generateCSharp(request) {
  const { method, url, headers, parts } = request
  const hasContent = sendsBody(request)
  const contentLines = hasContent
    ? [
        ...csharpContent(request),
        ...headers.filter(isContentHeader).map(({ key, value }) => `request.Content.Headers.TryAddWithoutValidation(${csharpQuote(key)}, ${csharpQuote(value)});`),
      ]
    : []
  const requestHeaders = hasContent ? headers.filter((header) => !isContentHeader(header)) : headers
  return [
    ...(hasFilePart(parts) ? ['using System.Net.Http.Headers;'] : []),
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

const rubyPart = (part) => (part.file === undefined
  ? `  [${singleQuote(part.name)}, ${singleQuote(part.value)}],`
  : `  [${singleQuote(part.name)}, File.open(${singleQuote(part.file)}), { filename: ${singleQuote(part.file)}, content_type: ${singleQuote(part.contentType)} }],`)

function rubyBody({ body, file, parts }) {
  if (parts) return ['request.set_form([', ...parts.map(rubyPart), "], 'multipart/form-data')"]
  if (file) return [`request.body = File.binread(${singleQuote(file)})`]
  return body ? [`request.body = ${singleQuote(body)}`] : []
}

function generateRuby(request) {
  const { method, url, headers } = request
  const expectsBody = method !== 'HEAD'
  return [
    "require 'net/http'",
    "require 'uri'",
    '',
    `uri = URI(${singleQuote(url)})`,
    'http = Net::HTTP.new(uri.host, uri.port)',
    "http.use_ssl = uri.scheme == 'https'",
    '',
    `request = Net::HTTPGenericRequest.new(${singleQuote(method)}, ${sendsBody(request)}, ${expectsBody}, uri.request_uri)`,
    ...headers.map(({ key, value }) => `request.add_field(${singleQuote(key)}, ${singleQuote(value)})`),
    ...rubyBody(request),
    '',
    'response = http.request(request)',
    'puts response.code',
    'puts response.body',
  ].join('\n')
}

const swiftFile = (file) => `try Data(contentsOf: URL(fileURLWithPath: ${swiftQuote(file)}))`

const swiftSegment = (segment) => (typeof segment === 'string'
  ? `form.append(${swiftQuote(segment)}.data(using: .utf8)!)`
  : `form.append(${swiftFile(segment.file)})`)

function swiftBody({ body, file, parts }) {
  if (parts) return ['var form = Data()', ...formSegments(parts).map(swiftSegment), 'request.httpBody = form']
  if (file) return [`request.httpBody = ${swiftFile(file)}`]
  return body ? [`request.httpBody = ${swiftQuote(body)}.data(using: .utf8)`] : []
}

function generateSwift(request) {
  const { method, url, parts } = request
  const headers = parts ? withFormType(request.headers) : request.headers
  return [
    'import Foundation',
    '',
    `var request = URLRequest(url: URL(string: ${swiftQuote(url)})!)`,
    `request.httpMethod = ${swiftQuote(method)}`,
    ...headers.map(({ key, value }) => `request.addValue(${swiftQuote(value)}, forHTTPHeaderField: ${swiftQuote(key)})`),
    ...swiftBody(request),
    '',
    'let (data, response) = try await URLSession.shared.data(for: request)',
    'print((response as! HTTPURLResponse).statusCode)',
    'print(String(decoding: data, as: UTF8.self))',
  ].join('\n')
}

const kotlinSegment = (segment) => (typeof segment === 'string'
  ? `    form.write(${kotlinQuote(segment)}.toByteArray())`
  : `    form.write(File(${kotlinQuote(segment.file)}).readBytes())`)

function kotlinBody({ body, file, parts }) {
  if (parts) {
    return {
      imports: ['import java.io.ByteArrayOutputStream', 'import java.io.File'],
      setup: ['    val form = ByteArrayOutputStream()', ...formSegments(parts).map(kotlinSegment), ''],
      publisher: 'HttpRequest.BodyPublishers.ofByteArray(form.toByteArray())',
    }
  }
  if (file) return { imports: ['import java.nio.file.Path'], setup: [], publisher: `HttpRequest.BodyPublishers.ofFile(Path.of(${kotlinQuote(file)}))` }
  return { imports: [], setup: [], publisher: body ? `HttpRequest.BodyPublishers.ofString(${kotlinQuote(body)})` : 'HttpRequest.BodyPublishers.noBody()' }
}

function generateKotlin(request) {
  const { method, url, parts } = request
  const { imports, setup, publisher } = kotlinBody(request)
  const headers = parts ? withFormType(request.headers) : request.headers
  return [
    ...imports,
    'import java.net.URI',
    'import java.net.http.HttpClient',
    'import java.net.http.HttpRequest',
    'import java.net.http.HttpResponse',
    '',
    'fun main() {',
    '    val client = HttpClient.newHttpClient()',
    ...setup,
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

const rustPart = (part) => (part.file === undefined
  ? `        .text(${rustQuote(part.name)}, ${rustQuote(part.value)})`
  : `        .file(${rustQuote(part.name)}, ${rustQuote(part.file)})?`)

function rustForm(parts) {
  const lines = ['    let form = reqwest::blocking::multipart::Form::new()', ...parts.map(rustPart)]
  return [...lines.slice(0, -1), `${lines.at(-1)};`]
}

function rustBody({ body, file, parts }) {
  if (parts) return ['        .multipart(form)']
  if (file) return [`        .body(std::fs::read(${rustQuote(file)})?)`]
  return body ? [`        .body(${rustQuote(body)})`] : []
}

function generateRust(request) {
  const { method, url, headers, parts } = request
  return [
    'fn main() -> Result<(), Box<dyn std::error::Error>> {',
    '    let client = reqwest::blocking::Client::new();',
    ...(parts ? rustForm(parts) : []),
    '    let response = client',
    `        .request(reqwest::Method::from_bytes(${rustQuote(method)}.as_bytes())?, ${rustQuote(url)})`,
    ...headers.map(({ key, value }) => `        .header(${rustQuote(key)}, ${rustQuote(value)})`),
    ...rustBody(request),
    '        .send()?;',
    '',
    '    println!("{}", response.status());',
    '    println!("{}", response.text()?);',
    '    Ok(())',
    '}',
  ].join('\n')
}

const dartPart = (part) => (part.file === undefined
  ? `  request.fields[${dartQuote(part.name)}] = ${dartQuote(part.value)};`
  : `  request.files.add(await http.MultipartFile.fromPath(${dartQuote(part.name)}, ${dartQuote(part.file)}));`)

function dartBody({ body, file, parts }) {
  if (parts) return parts.map(dartPart)
  if (file) return [`  request.bodyBytes = await File(${dartQuote(file)}).readAsBytes();`]
  return body ? [`  request.bodyBytes = utf8.encode(${dartQuote(body)});`] : []
}

function dartImports({ body, file }) {
  if (file) return ["import 'dart:io';", '']
  return body ? ["import 'dart:convert';", ''] : []
}

function generateDart(request) {
  const { method, url, headers, parts } = request
  const merged = mergeRepeatedHeaders(headers)
  return [
    ...dartImports(request),
    "import 'package:http/http.dart' as http;",
    '',
    'Future<void> main() async {',
    `  final request = http.${parts ? 'MultipartRequest' : 'Request'}(${dartQuote(method)}, Uri.parse(${dartQuote(url)}));`,
    ...(merged.length > 0
      ? ['  request.headers.addAll({', ...merged.map(({ key, value }) => `    ${dartQuote(key)}: ${dartQuote(value)},`), '  });']
      : []),
    ...dartBody(request),
    '',
    '  final response = await http.Response.fromStream(await request.send());',
    '  print(response.statusCode);',
    '  print(response.body);',
    '}',
  ].join('\n')
}

const powershellPart = (part) => (part.file === undefined
  ? `    ${powershellQuote(part.name)} = ${powershellQuote(part.value)}`
  : `    ${powershellQuote(part.name)} = Get-Item ${powershellQuote(part.file)}`)

function powershellBody({ body, file, parts }, lines, call) {
  if (parts) {
    lines.push('$form = @{', ...parts.map(powershellPart), '}')
    call.push('-Form $form')
  } else if (file) {
    call.push(`-InFile ${powershellQuote(file)}`)
  } else if (body) {
    lines.push(`$body = [System.Text.Encoding]::UTF8.GetBytes(${powershellQuote(body)})`)
    call.push('-Body $body')
  }
}

function generatePowerShell(request) {
  const { method, url, headers } = request
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
  powershellBody(request, lines, call)
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

const LANGUAGE_KEY = 'gostman.codeLanguage'

export function rememberedLanguage() {
  const stored = readStored(LANGUAGE_KEY)
  return SNIPPET_LANGUAGES.some(({ id }) => id === stored) ? stored : SNIPPET_LANGUAGES[0].id
}

export const rememberLanguage = (id) => writeStored(LANGUAGE_KEY, id)

export function generateAllSnippets(prepared) {
  const headers = prepared.headers || []
  const upload = uploadOf(prepared)
  const request = {
    method: prepared.method,
    url: prepared.url,
    headers: upload.parts ? headers.filter((header) => !isContentType(header)) : headers,
    body: upload.file || upload.parts ? '' : prepared.body || '',
    ...upload,
  }
  return Object.fromEntries(SNIPPET_LANGUAGES.map(({ id, generate }) => [id, generate(request)]))
}
