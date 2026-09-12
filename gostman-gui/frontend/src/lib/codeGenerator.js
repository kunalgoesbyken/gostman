import { parseJSON } from './dataUtils'

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
  const bodyObj = parseJSON(body)
  const paramsObj = parseJSON(queryParams)

  const fullUrl = buildUrl(url, paramsObj)
  let curl = `curl -X ${method} "${fullUrl}"`

  Object.entries(headersObj).forEach(([key, value]) => {
    curl += ` \\\n  -H "${key}: ${value}"`
  })

  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && Object.keys(bodyObj).length > 0) {
    const bodyString = JSON.stringify(bodyObj, null, 2)
    curl += ` \\\n  -d '${bodyString}'`
  }

  return curl
}

function generateJavaScript(method, url, headers, body, queryParams) {
  const headersObj = parseJSON(headers)
  const bodyObj = parseJSON(body)
  const paramsObj = parseJSON(queryParams)

  const fullUrl = buildUrl(url, paramsObj)
  let code = `fetch("${fullUrl}", {\n`
  code += `  method: "${method}",\n`

  const hasHeaders = Object.keys(headersObj).length > 0
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && Object.keys(bodyObj).length > 0

  if (hasHeaders) {
    code += `  headers: {\n${formatHeaders(headersObj)}\n  }`
  }

  if (hasBody) {
    if (hasHeaders) code += ',\n'
    const bodyString = JSON.stringify(bodyObj, null, 2)
    code += `  body: JSON.stringify(${bodyString})\n`
  } else {
    code += '\n'
  }

  code += `})\n`
  code += `  .then(response => response.json())\n`
  code += `  .then(data => console.log(data))\n`
  code += `  .catch(error => console.error('Error:', error))`

  return code
}

function formatHeaders(headersObj) {
  return Object.entries(headersObj)
    .map(([key, value]) => `    "${key}": "${value}"`)
    .join(',\n')
}

function generatePython(method, url, headers, body, queryParams) {
  const headersObj = parseJSON(headers)
  const bodyObj = parseJSON(body)
  const paramsObj = parseJSON(queryParams)

  let code = `import requests\n\n`
  code += `url = "${url}"\n`

  const hasParams = Object.keys(paramsObj).length > 0
  const hasHeaders = Object.keys(headersObj).length > 0
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && Object.keys(bodyObj).length > 0

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

  if (hasBody) {
    const bodyString = JSON.stringify(bodyObj, null, 2)
      .split('\n')
      .map((line) => '    ' + line)
      .join('\n')
    code += `\ndata = ${bodyString}\n`
  }

  code += `\nresponse = requests.${method.toLowerCase()}(`
  code += hasParams ? 'url, params=params' : 'url'
  if (hasHeaders) code += ', headers=headers'
  if (hasBody) code += ', json=data'

  code += `)\n\n`
  code += `print(response.status_code)\n`
  code += `print(response.json())`

  return code
}

function generateGo(method, url, headers, body, queryParams) {
  const headersObj = parseJSON(headers)
  const bodyObj = parseJSON(body)
  const paramsObj = parseJSON(queryParams)

  const fullUrl = buildUrl(url, paramsObj)

  let code = `package main\n\n`
  code += `import (\n`
  code += `    "bytes"\n`
  code += `    "encoding/json"\n`
  code += `    "fmt"\n`
  code += `    "io"\n`
  code += `    "net/http"\n`
  code += `)\n\n`

  code += `func main() {`

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && Object.keys(bodyObj).length > 0

  if (hasBody) {
    const bodyString = JSON.stringify(bodyObj, null, 4)
      .split('\n')
      .map((line) => '    ' + line)
      .join('\n')
    code += `    requestBody := map[string]interface{}${bodyString}\n`
    code += `    bodyBytes, _ := json.Marshal(requestBody)\n\n`
  }

  code += `    req, _ := http.NewRequest("${method}", "${fullUrl}"`
  code += hasBody ? `, bytes.NewBuffer(bodyBytes))\n\n` : `, nil)\n\n`

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
  const bodyObj = parseJSON(body)
  const paramsObj = parseJSON(queryParams)

  const fullUrl = buildUrl(url, paramsObj)
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && Object.keys(bodyObj).length > 0

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

  if (hasBody) {
    const bodyString = JSON.stringify(bodyObj, null, 2)
    code += `curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpString(bodyString)});\n`
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
  const bodyObj = parseJSON(body)
  const paramsObj = parseJSON(queryParams)

  const fullUrl = buildUrl(url, paramsObj)
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && Object.keys(bodyObj).length > 0

  let code = `import java.net.URI;\n`
  code += `import java.net.http.HttpClient;\n`
  code += `import java.net.http.HttpRequest;\n`
  code += `import java.net.http.HttpResponse;\n\n`

  code += `public class Main {\n`
  code += `    public static void main(String[] args) throws Exception {\n`
  code += `        HttpClient client = HttpClient.newHttpClient();\n\n`

  if (hasBody) {
    const bodyString = JSON.stringify(bodyObj, null, 2)
    code += `        String requestBody = ${javaString(bodyString)};\n\n`
  }

  code += `        HttpRequest request = HttpRequest.newBuilder()\n`
  code += `            .uri(URI.create(${javaString(fullUrl)}))\n`

  Object.entries(headersObj).forEach(([key, value]) => {
    code += `            .header(${javaString(key)}, ${javaString(value)})\n`
  })

  const bodyPublisher = hasBody
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
