import { parseJSON } from './dataUtils'

const BODY_METHODS = ['POST', 'PUT', 'PATCH']

/**
 * Keeps the body as the text the user typed and reports whether it happens to
 * be JSON, so generators can pick a JSON idiom without discarding payloads
 * JSON cannot model. `json` is set only for objects and arrays, the shapes
 * those idioms can render as a literal.
 */
function describeBody(method, body) {
  const text = typeof body === 'string' ? body.trim() : ''
  if (!BODY_METHODS.includes(method.toUpperCase()) || !text) {
    return { present: false, text: '', json: null, isJson: false }
  }

  let json = null
  try {
    const parsed = JSON.parse(text)
    if (parsed !== null && typeof parsed === 'object') json = parsed
  } catch {
    json = null
  }

  return { present: true, text, json, isJson: json !== null }
}

function buildUrl(url, params) {
  if (Object.keys(params).length === 0) return url
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => searchParams.append(key, v))
    } else {
      searchParams.set(key, value)
    }
  })
  const qs = searchParams.toString()
  return `${url}${url.includes('?') ? '&' : '?'}${qs}`
}

function buildCurlCommand(method, url, headers, body, queryParams) {
  const headersObj = parseJSON(headers)
  const paramsObj = parseJSON(queryParams)
  const payload = describeBody(method, body)

  const fullUrl = buildUrl(url, paramsObj)
  let curl = `curl -X ${method} "${fullUrl}"`

  Object.entries(headersObj).forEach(([key, value]) => {
    curl += ` \\\n  -H "${key}: ${value}"`
  })

  if (payload.present) {
    // Single quotes end the shell literal, so close, escape, and reopen.
    const escaped = payload.text.replace(/'/g, `'\\''`)
    curl += ` \\\n  -d '${escaped}'`
  }

  return curl
}

function generateJavaScript(method, url, headers, body, queryParams) {
  const headersObj = parseJSON(headers)
  const paramsObj = parseJSON(queryParams)
  const payload = describeBody(method, body)

  const fullUrl = buildUrl(url, paramsObj)
  let code = `fetch("${fullUrl}", {\n`
  code += `  method: "${method}",\n`

  const hasHeaders = Object.keys(headersObj).length > 0

  if (hasHeaders) {
    code += `  headers: {\n${formatHeaders(headersObj)}\n  }`
  }

  if (payload.present) {
    if (hasHeaders) code += ',\n'
    const value = payload.isJson
      ? `JSON.stringify(${JSON.stringify(payload.json, null, 2)})`
      : JSON.stringify(payload.text)
    code += `  body: ${value}\n`
  } else {
    code += '\n'
  }

  code += `})\n`
  code += `  .then(response => response.json())\n`
  code += `  .then(data => console.log(data))\n`
  code += `  .catch(error => console.error('Error:', error))`

  return code
}

function indentLines(text, indent) {
  return text.split('\n').map((line, i) => (i === 0 ? line : indent + line)).join('\n')
}

function pythonString(value) {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')
  return value.includes('\n') ? `"""${escaped}"""` : `"${escaped.replace(/"/g, '\\"')}"`
}

function formatHeaders(headersObj) {
  return Object.entries(headersObj)
    .map(([key, value]) => `    "${key}": "${value}"`)
    .join(',\n')
}

function generatePython(method, url, headers, body, queryParams) {
  const headersObj = parseJSON(headers)
  const paramsObj = parseJSON(queryParams)
  const payload = describeBody(method, body)

  let code = `import requests\n\n`
  code += `url = "${url}"\n`

  const hasParams = Object.keys(paramsObj).length > 0
  const hasHeaders = Object.keys(headersObj).length > 0

  if (hasParams) {
    code += `params = {\n`
    Object.entries(paramsObj).forEach(([key, value], index) => {
      const formattedValue = typeof value === 'string' ? `"${value}"` : value
      code += `    "${key}": ${formattedValue}${index < Object.keys(paramsObj).length - 1 ? ',' : ''}\n`
    })
    code += `}\n`
  }

  if (hasHeaders) {
    code += `headers = {\n${formatHeaders(headersObj)}\n}\n`
  }

  if (payload.present) {
    code += payload.isJson
      ? `\ndata = ${indentLines(JSON.stringify(payload.json, null, 2), '    ')}\n`
      : `\ndata = ${pythonString(payload.text)}\n`
  }

  code += `\nresponse = requests.${method.toLowerCase()}(`
  code += hasParams ? 'url, params=params' : 'url'
  if (hasHeaders) code += ', headers=headers'
  if (payload.present) code += payload.isJson ? ', json=data' : ', data=data'

  code += `)\n\n`
  code += `print(response.status_code)\n`
  code += `print(response.json())`

  return code
}

/** Go composite literals require a trailing comma before a closing brace on its own line. */
function goLiteral(value, indent) {
  if (value === null) return 'nil'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  const inner = indent + '    '
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]interface{}{}'
    const items = value.map((v) => `${inner}${goLiteral(v, inner)},\n`).join('')
    return `[]interface{}{\n${items}${indent}}`
  }

  const entries = Object.entries(value)
  if (entries.length === 0) return 'map[string]interface{}{}'
  const fields = entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${goLiteral(v, inner)},\n`).join('')
  return `map[string]interface{}{\n${fields}${indent}}`
}

function generateGo(method, url, headers, body, queryParams) {
  const headersObj = parseJSON(headers)
  const paramsObj = parseJSON(queryParams)
  const payload = describeBody(method, body)

  const fullUrl = buildUrl(url, paramsObj)

  const usesJsonBody = payload.present && payload.isJson
  const usesRawBody = payload.present && !payload.isJson

  const imports = ['"fmt"', '"io"', '"net/http"']
  if (usesJsonBody) imports.unshift('"bytes"', '"encoding/json"')
  if (usesRawBody) imports.push('"strings"')

  let code = `package main\n\n`
  code += `import (\n`
  code += imports.map((pkg) => `    ${pkg}\n`).join('')
  code += `)\n\n`

  code += `func main() {\n`

  if (usesJsonBody) {
    code += `    requestBody := ${goLiteral(payload.json, '    ')}\n`
    code += `    bodyBytes, _ := json.Marshal(requestBody)\n\n`
  }

  code += `    req, _ := http.NewRequest("${method}", "${fullUrl}"`
  if (usesJsonBody) code += `, bytes.NewBuffer(bodyBytes))\n\n`
  else if (usesRawBody) code += `, strings.NewReader(${JSON.stringify(payload.text)}))\n\n`
  else code += `, nil)\n\n`

  if (Object.keys(headersObj).length > 0) {
    Object.entries(headersObj).forEach(([key, value]) => {
      code += `    req.Header.Set("${key}", "${value}")\n`
    })
    code += `\n`
  }

  code += `    client := &http.Client{}\n`
  code += `    resp, _ := client.Do(req)\n`
  code += `    defer resp.Body.Close()\n\n`
  code += `    responseBody, _ := io.ReadAll(resp.Body)\n`
  code += `    fmt.Println(string(responseBody))\n`
  code += `}`

  return code
}

function phpString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function generatePhp(method, url, headers, body, queryParams) {
  const headersObj = parseJSON(headers)
  const paramsObj = parseJSON(queryParams)
  const payload = describeBody(method, body)

  const fullUrl = buildUrl(url, paramsObj)

  let code = `<?php\n\n`
  code += `$ch = curl_init();\n\n`
  code += `curl_setopt($ch, CURLOPT_URL, ${phpString(fullUrl)});\n`
  code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpString(method)});\n`
  code += `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`

  if (Object.keys(headersObj).length > 0) {
    const headerLines = Object.entries(headersObj)
      .map(([key, value]) => `    ${phpString(`${key}: ${value}`)},`)
      .join('\n')
    code += `curl_setopt($ch, CURLOPT_HTTPHEADER, [\n${headerLines}\n]);\n`
  }

  if (payload.present) {
    code += `curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpString(payload.text)});\n`
  }

  code += `\n$response = curl_exec($ch);\n`
  code += `$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);\n`
  code += `curl_close($ch);\n\n`
  code += `echo $statusCode . PHP_EOL;\n`
  code += `echo $response . PHP_EOL;`

  return code
}

function javaString(value) {
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
  return `"${escaped}"`
}

function generateJava(method, url, headers, body, queryParams) {
  const headersObj = parseJSON(headers)
  const paramsObj = parseJSON(queryParams)
  const payload = describeBody(method, body)

  const fullUrl = buildUrl(url, paramsObj)

  let code = `import java.net.URI;\n`
  code += `import java.net.http.HttpClient;\n`
  code += `import java.net.http.HttpRequest;\n`
  code += `import java.net.http.HttpResponse;\n\n`

  code += `public class Main {\n`
  code += `    public static void main(String[] args) throws Exception {\n`
  code += `        HttpClient client = HttpClient.newHttpClient();\n\n`

  if (payload.present) {
    code += `        String requestBody = ${javaString(payload.text)};\n\n`
  }

  code += `        HttpRequest request = HttpRequest.newBuilder()\n`
  code += `            .uri(URI.create(${javaString(fullUrl)}))\n`

  Object.entries(headersObj).forEach(([key, value]) => {
    code += `            .header(${javaString(key)}, ${javaString(value)})\n`
  })

  const bodyPublisher = payload.present
    ? 'HttpRequest.BodyPublishers.ofString(requestBody)'
    : 'HttpRequest.BodyPublishers.noBody()'
  code += `            .method(${javaString(method)}, ${bodyPublisher})\n`
  code += `            .build();\n\n`

  code += `        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\n\n`
  code += `        System.out.println(response.statusCode());\n`
  code += `        System.out.println(response.body());\n`
  code += `    }\n`
  code += `}`

  return code
}

export function generateAllSnippets(method, url, headers, body, queryParams) {
  return {
    curl: buildCurlCommand(method, url, headers, body, queryParams),
    javascript: generateJavaScript(method, url, headers, body, queryParams),
    python: generatePython(method, url, headers, body, queryParams),
    go: generateGo(method, url, headers, body, queryParams),
    php: generatePhp(method, url, headers, body, queryParams),
    java: generateJava(method, url, headers, body, queryParams),
  }
}
