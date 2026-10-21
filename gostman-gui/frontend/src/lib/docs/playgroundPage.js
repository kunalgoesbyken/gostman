import { CONTENT_POLICY } from './page'

export const PLAYGROUND_POLICY = `${CONTENT_POLICY}; connect-src http: https:`

const MESSAGES = {
  noUrl: 'Enter a URL first.',
  sending: 'Sending',
  send: 'Send',
  timeout: 'The request took longer than 60 seconds and was cancelled.',
  failure: 'The request did not complete. Browsers block cross-origin calls unless the API allows this page\'s origin (CORS), and they also fail when the server cannot be reached, the address or a header is invalid, or an http address is called from an https page. Open the browser console for the exact reason, or send the request from the Gostman app or curl, which are not bound by CORS.',
  truncated: 'Body shortened for display.',
  noBody: '(empty body)',
}

export const PLAYGROUND_STYLE = `
.try { margin-top: 1.5rem; border: 1px solid var(--line); border-radius: 6px; font-size: 0.875rem; }
.try > summary { padding: 0.5rem 0.75rem; color: var(--ink); font-weight: 650; }
.try-body { padding: 0 0.75rem 0.75rem; }
.try-line { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.try input, .try select, .try textarea { min-width: 0; padding: 0.35rem 0.5rem; border: 1px solid var(--line); border-radius: 4px; background: var(--page); color: var(--ink); font: 0.8125rem var(--mono); }
.try-line input { flex: 1; }
.try textarea { display: block; width: 100%; resize: vertical; }
.try-variables { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.5rem; margin-top: 0.5rem; }
.try-variable { display: flex; flex-direction: column; gap: 0.25rem; }
.try-header { display: flex; gap: 0.5rem; margin-top: 0.375rem; }
.try-header input { flex: 1; }
.try-button { margin-top: 0.5rem; padding: 0.3rem 0.75rem; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--ink); font: inherit; cursor: pointer; }
.try-button:disabled { color: var(--soft); cursor: default; }
.try-send { border-color: var(--link); color: var(--link); }
.try-result { margin-top: 0.75rem; }
.try-error { color: var(--delete); }
.try-summary { font-family: var(--mono); font-size: 0.8125rem; }
@media print { .try { display: none; } }
`

export const PLAYGROUND_SCRIPT = `
(function () {
  var TEXT = ${JSON.stringify(MESSAGES)};
  var TIMEOUT_MS = 60000;
  var BODY_LIMIT = 200000;
  var BODYLESS = ['GET', 'HEAD'];
  var PLACEHOLDER = /\\{\\{([^}]+)\\}\\}/g;

  function field(panel, name) {
    return panel.querySelector('[' + name + ']');
  }

  function variablesOf(panel) {
    var values = {};
    Array.prototype.forEach.call(panel.querySelectorAll('[data-variable]'), function (input) {
      values[input.getAttribute('data-variable')] = input.value;
    });
    return values;
  }

  function substitute(text, values) {
    return text.replace(PLACEHOLDER, function (match, name) {
      var key = name.trim();
      return Object.prototype.hasOwnProperty.call(values, key) && values[key] !== '' ? values[key] : match;
    });
  }

  function headersOf(panel, values) {
    var headers = new Headers();
    Array.prototype.forEach.call(panel.querySelectorAll('[data-header]'), function (row) {
      var name = row.querySelector('[data-header-name]').value.trim();
      if (name !== '') headers.append(name, substitute(row.querySelector('[data-header-value]').value, values));
    });
    return headers;
  }

  function requestOf(panel) {
    var values = variablesOf(panel);
    var method = field(panel, 'data-method').value;
    var body = field(panel, 'data-body');
    return {
      url: substitute(field(panel, 'data-url').value.trim(), values),
      options: {
        method: method,
        headers: headersOf(panel, values),
        body: body && BODYLESS.indexOf(method) === -1 && body.value !== '' ? substitute(body.value, values) : undefined,
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer'
      }
    };
  }

  function formatSize(bytes) {
    return bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB';
  }

  function showFailure(panel, message) {
    field(panel, 'data-result').hidden = false;
    field(panel, 'data-summary').textContent = '';
    field(panel, 'data-response-headers').textContent = '';
    field(panel, 'data-response-body').textContent = '';
    var error = field(panel, 'data-error');
    error.textContent = message;
    error.hidden = false;
  }

  function showResponse(panel, response, buffer, elapsed) {
    var lines = [];
    response.headers.forEach(function (value, name) { lines.push(name + ': ' + value); });
    var text = new TextDecoder().decode(buffer);
    var shortened = text.length > BODY_LIMIT;
    field(panel, 'data-result').hidden = false;
    field(panel, 'data-error').hidden = true;
    field(panel, 'data-summary').textContent = response.status + ' ' + response.statusText + ' \\u00b7 ' + Math.round(elapsed) + ' ms \\u00b7 ' + formatSize(buffer.byteLength) + (shortened ? ' \\u00b7 ' + TEXT.truncated : '');
    field(panel, 'data-response-headers').textContent = lines.join('\\n');
    field(panel, 'data-response-body').textContent = text === '' ? TEXT.noBody : text.slice(0, BODY_LIMIT);
  }

  function send(panel, button) {
    var request;
    try {
      request = requestOf(panel);
    } catch (error) {
      showFailure(panel, TEXT.failure);
      return;
    }
    if (request.url === '') {
      showFailure(panel, TEXT.noUrl);
      return;
    }
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    var started = performance.now();
    request.options.signal = controller.signal;
    button.disabled = true;
    button.textContent = TEXT.sending;
    fetch(request.url, request.options)
      .then(function (response) {
        return response.arrayBuffer().then(function (buffer) {
          showResponse(panel, response, buffer, performance.now() - started);
        });
      })
      .catch(function (error) {
        showFailure(panel, error && error.name === 'AbortError' ? TEXT.timeout : TEXT.failure);
      })
      .then(function () {
        clearTimeout(timer);
        button.disabled = false;
        button.textContent = TEXT.send;
      });
  }

  function addHeader(panel) {
    var row = field(panel, 'data-header').cloneNode(true);
    Array.prototype.forEach.call(row.querySelectorAll('input'), function (input) { input.value = ''; });
    field(panel, 'data-headers').appendChild(row);
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-try]'), function (panel) {
    var button = field(panel, 'data-send');
    button.addEventListener('click', function () { send(panel, button); });
    field(panel, 'data-add-header').addEventListener('click', function () { addHeader(panel); });
  });
})();
`
