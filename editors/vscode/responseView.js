const vscode = require("vscode");
const { methodTone, statusTone } = require("./tones");

const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  file: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
};
const JSON_INDENT = "  ";
const BARE_KEY = /^[A-Za-z_$][\w$]*$/;
const BYTE_UNITS = [
  (size) => vscode.l10n.t("{0} B", size),
  (size) => vscode.l10n.t("{0} KB", size),
  (size) => vscode.l10n.t("{0} MB", size),
  (size) => vscode.l10n.t("{0} GB", size),
];

function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function icon(name, tone) {
  const toneClass = tone ? ` tone-${tone}` : "";
  return `<svg class="icon${toneClass}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

function formatBytes(bytes) {
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024;
    unit++;
  }
  const digits = unit === 0 ? 0 : 1;
  return BYTE_UNITS[unit](new Intl.NumberFormat(vscode.env.language, { maximumFractionDigits: digits }).format(size));
}

function token(kind, text) {
  return `<span class="syntax-${kind}">${escapeHtml(text)}</span>`;
}

function jsonScalar(value) {
  if (value === null) return token("null", "null");
  if (typeof value === "string") return token("string", JSON.stringify(value));
  if (typeof value === "number") return token("number", String(value));
  return token("boolean", String(value));
}

function jsonEntries(entries, depth, open, close) {
  if (entries.length === 0) return token("punctuation", `${open}${close}`);
  const inner = JSON_INDENT.repeat(depth + 1);
  const lines = entries.map((entry, index) => `${inner}${entry}${index < entries.length - 1 ? token("punctuation", ",") : ""}`);
  return `${token("punctuation", open)}\n${lines.join("\n")}\n${JSON_INDENT.repeat(depth)}${token("punctuation", close)}`;
}

function jsonHtml(value, depth = 0) {
  if (Array.isArray(value)) return jsonEntries(value.map((item) => jsonHtml(item, depth + 1)), depth, "[", "]");
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([key, item]) => `${token("key", BARE_KEY.test(key) ? key : JSON.stringify(key))}${token("punctuation", ":")} ${jsonHtml(item, depth + 1)}`);
    return jsonEntries(entries, depth, "{", "}");
  }
  return jsonScalar(value);
}

function parsedJson(text) {
  const start = text.trimStart()[0];
  if (start !== "{" && start !== "[") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function notice(tone, iconName, text) {
  return text ? `<div class="notice tone-${tone}">${icon(iconName)}<p>${escapeHtml(text)}</p></div>` : "";
}

function emptyState(iconName, title, description) {
  const detail = description ? `<p class="empty-description">${escapeHtml(description)}</p>` : "";
  return `<div class="empty">${icon(iconName)}<p class="empty-title">${escapeHtml(title)}</p>${detail}</div>`;
}

function bodyPanel(outcome) {
  const { body } = outcome;
  if (outcome.error) return emptyState("alert", vscode.l10n.t("Request failed"), outcome.error);
  if (body.bytes === 0) return emptyState("file", vscode.l10n.t("Empty response body"), vscode.l10n.t("The server answered {0} without a body.", outcome.status));
  if (body.encoding === "base64") return emptyState("file", vscode.l10n.t("Binary response, {0}", formatBytes(outcome.sizeBytes)), outcome.contentType);
  const text = body.text ?? "";
  const json = parsedJson(text);
  return `<pre class="code">${json === undefined ? escapeHtml(text) : jsonHtml(json)}</pre>`;
}

function headersPanel(outcome) {
  const headers = outcome.headers ?? [];
  if (headers.length === 0) return emptyState("file", vscode.l10n.t("No headers"), vscode.l10n.t("The server sent no headers."));
  const rows = headers.map((header) => `<tr><th scope="row">${escapeHtml(header.key)}</th><td>${escapeHtml(header.value)}</td></tr>`);
  return `<table class="pairs"><tbody>${rows.join("")}</tbody></table>`;
}

function checksPanel(outcome) {
  const rows = outcome.tests.map((check) => {
    const message = check.message ? `<p class="check-message">${escapeHtml(check.message)}</p>` : "";
    return `<li>${icon(check.passed ? "check" : "x", check.passed ? "success" : "destructive")}<div><p class="check-name">${escapeHtml(check.name)}</p>${message}</div></li>`;
  });
  return `<ul class="checks">${rows.join("")}</ul>`;
}

function consolePanel(outcome) {
  const lines = outcome.logs.map((line) => `<span class="log-${escapeHtml(line.level)}">${escapeHtml(line.level)}</span> ${escapeHtml(line.text)}`);
  return `<pre class="code">${lines.join("\n")}</pre>`;
}

function tabsOf(outcome) {
  const tests = outcome.tests ?? [];
  const logs = outcome.logs ?? [];
  const passed = tests.filter((check) => check.passed).length;
  const testTone = passed < tests.length ? "destructive" : "success";
  return [
    { id: "body", label: vscode.l10n.t("Body"), panel: () => bodyPanel(outcome) },
    { id: "headers", label: vscode.l10n.t("Headers"), count: outcome.headers?.length || undefined, panel: () => headersPanel(outcome) },
    tests.length > 0 && { id: "checks", label: vscode.l10n.t("Checks"), count: `${passed}/${tests.length}`, tone: testTone, panel: () => checksPanel(outcome) },
    logs.length > 0 && { id: "console", label: vscode.l10n.t("Console"), count: logs.length, panel: () => consolePanel(outcome) },
  ].filter(Boolean);
}

function tabStrip(tabs) {
  const inputs = tabs.map((tab, index) => `<input type="radio" name="tab" id="tab-${tab.id}" class="tab-input"${index === 0 ? " checked" : ""}>`);
  const labels = tabs.map((tab) => {
    const count = tab.count === undefined ? "" : `<span class="count${tab.tone ? ` tone-${tab.tone}` : ""}">${escapeHtml(tab.count)}</span>`;
    return `<label for="tab-${tab.id}" class="tab tab-${tab.id}">${escapeHtml(tab.label)}${count}</label>`;
  });
  const panels = tabs.map((tab) => `<section class="panel panel-${tab.id}" aria-label="${escapeHtml(tab.label)}">${tab.panel()}</section>`);
  return { inputs: inputs.join(""), labels: labels.join(""), panels: panels.join("") };
}

function statusSummary(outcome) {
  const status = outcome.error ? vscode.l10n.t("Error") : outcome.status;
  const timing = `${vscode.l10n.t("{0} ms", outcome.durationMs)} · ${formatBytes(outcome.sizeBytes)}`;
  return `<div class="status" role="status"><span class="badge tone-${statusTone(outcome)}">${escapeHtml(status)}</span><span class="timing">${escapeHtml(timing)}</span></div>`;
}

function notices(outcome, warnings) {
  const { body } = outcome;
  const cut = body.truncated && body.encoding !== "base64" ? vscode.l10n.t("Showing {0} of {1}.", formatBytes(body.returnedBytes), formatBytes(body.bytes)) : "";
  return [
    notice("warning", "info", outcome.unresolved?.length && vscode.l10n.t("Placeholders with no value: {0}", outcome.unresolved.join(", "))),
    notice("warning", "info", outcome.withheld?.length && vscode.l10n.t("Secrets not filled in: {0}", outcome.withheld.join(", "))),
    notice("muted", "info", outcome.skipped && vscode.l10n.t("Skipped: {0}", outcome.skipped)),
    notice("muted", "info", outcome.hint),
    notice("warning", "scissors", [cut, body.note].filter(Boolean).join(" ")),
    notice("warning", "alert", warnings),
  ].join("");
}

function renderResponse(outcome, warnings, assets) {
  const tabs = tabStrip(tabsOf(outcome));
  const title = outcome.request || `${outcome.method} ${outcome.url}`;
  const address = outcome.resolvedUrl || outcome.url;
  const csp = `default-src 'none'; style-src ${assets.cspSource}; font-src ${assets.cspSource}; img-src ${assets.cspSource};`;
  return `<!DOCTYPE html>
<html lang="${escapeHtml(vscode.env.language)}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${assets.styleUri}">
<title>${escapeHtml(title)}</title></head>
<body>
<header class="request">
<p class="request-name"><span class="mark" aria-hidden="true"></span><span>${escapeHtml(title)}</span></p>
<p class="request-line"><span class="method tone-${methodTone(outcome.method)}">${escapeHtml(outcome.method)}</span><span class="address">${escapeHtml(address)}</span></p>
</header>
<main class="response" aria-label="${escapeHtml(vscode.l10n.t("Response"))}">${tabs.inputs}
<div class="toolbar"><div class="tabs">${tabs.labels}</div>${statusSummary(outcome)}</div>
${notices(outcome, warnings)}<div class="panels">${tabs.panels}</div>
</main>
</body></html>`;
}

module.exports = { renderResponse };
