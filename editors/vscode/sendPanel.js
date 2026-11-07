const vscode = require("vscode");
const { capture } = require("./cli");
const { environmentArgs } = require("./settings");
const { collectionOf } = require("./collections");
const { requestReference } = require("./workspaceFiles");
const { parseOutcome, describeCheck } = require("./report");

const PANEL_BODY_BYTES = 256 * 1024;
const BYTE_UNITS = [
  (size) => vscode.l10n.t("{0} B", size),
  (size) => vscode.l10n.t("{0} KB", size),
  (size) => vscode.l10n.t("{0} MB", size),
  (size) => vscode.l10n.t("{0} GB", size),
];
const STYLE = `
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 1rem; }
  h1 { font-size: 1.2em; margin: 0 0 .25rem; word-break: break-all; }
  h2 { font-size: 1em; margin: 1.25rem 0 .25rem; }
  .summary span { margin-right: 1rem; }
  .passed { color: var(--vscode-testing-iconPassed); }
  .failed { color: var(--vscode-testing-iconFailed); }
  .muted { color: var(--vscode-descriptionForeground); }
  pre { background: var(--vscode-textCodeBlock-background); padding: .75rem; overflow: auto; white-space: pre-wrap; word-break: break-word; font-family: var(--vscode-editor-font-family); }
  ul { padding-left: 1.25rem; }
`;

let panel;

function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
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

function bodyText(outcome) {
  const { body } = outcome;
  if (body.encoding === "base64") return vscode.l10n.t("Binary body, {0}. Not shown.", formatBytes(outcome.sizeBytes));
  return body.text ?? "";
}

function checksSection(outcome) {
  if (!outcome.tests?.length) return "";
  const rows = outcome.tests.map((check) => `<li class="${check.passed ? "passed" : "failed"}">${escapeHtml(describeCheck(check))}</li>`);
  return `<h2>${escapeHtml(vscode.l10n.t("Checks"))}</h2><ul>${rows.join("")}</ul>`;
}

function headersSection(outcome) {
  if (!outcome.headers?.length) return "";
  const rows = outcome.headers.map((header) => `${escapeHtml(header.key)}: ${escapeHtml(header.value)}`);
  return `<details><summary>${escapeHtml(vscode.l10n.t("Response headers"))}</summary><pre>${rows.join("\n")}</pre></details>`;
}

function bodySection(outcome) {
  const { body } = outcome;
  if (body.bytes === 0) return "";
  const shown = body.truncated && body.encoding !== "base64" ? vscode.l10n.t("Showing {0} of {1}.", formatBytes(body.returnedBytes), formatBytes(body.bytes)) : "";
  const note = [shown, body.note].filter(Boolean).join(" ");
  return `<h2>${escapeHtml(vscode.l10n.t("Body"))}</h2>${noteSection(note)}<pre>${escapeHtml(bodyText(outcome))}</pre>`;
}

function errorSection(outcome) {
  return outcome.error ? `<h2>${escapeHtml(vscode.l10n.t("Error"))}</h2><pre class="failed">${escapeHtml(outcome.error)}</pre>` : "";
}

function namesSection(title, names) {
  if (!names?.length) return "";
  return `<h2>${escapeHtml(title)}</h2><ul>${names.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`;
}

function noteSection(text) {
  return text ? `<p class="muted">${escapeHtml(text)}</p>` : "";
}

function logsSection(outcome) {
  if (!outcome.logs?.length) return "";
  const lines = outcome.logs.map((line) => `${line.level}: ${line.text}`);
  return `<details><summary>${escapeHtml(vscode.l10n.t("Script logs"))}</summary><pre>${escapeHtml(lines.join("\n"))}</pre></details>`;
}

function warningsSection(warnings) {
  return warnings ? `<h2>${escapeHtml(vscode.l10n.t("Warnings"))}</h2><pre>${escapeHtml(warnings)}</pre>` : "";
}

function explanation(outcome, warnings) {
  return [
    noteSection(outcome.skipped && vscode.l10n.t("Skipped: {0}", outcome.skipped)),
    namesSection(vscode.l10n.t("Placeholders with no value"), outcome.unresolved),
    namesSection(vscode.l10n.t("Secrets not filled in"), outcome.withheld),
    noteSection(outcome.hint),
    warningsSection(warnings),
  ].join("");
}

function renderOutcome(outcome, warnings) {
  const state = outcome.failed ? "failed" : "passed";
  const details = [outcome.status, vscode.l10n.t("{0} ms", outcome.durationMs), formatBytes(outcome.sizeBytes), outcome.contentType].filter(Boolean);
  const summary = details.map((text, index) => `<span${index === 0 ? ` class="${state}"` : ""}>${escapeHtml(text)}</span>`).join("");
  const title = escapeHtml(outcome.request || `${outcome.method} ${outcome.url}`);
  const address = escapeHtml(outcome.resolvedUrl || outcome.url);
  return `<!DOCTYPE html>
<html lang="${escapeHtml(vscode.env.language)}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>${STYLE}</style></head>
<body>
<h1>${title}</h1>
<p class="muted">${escapeHtml(outcome.method)} ${address}</p>
<p class="summary">${summary}</p>
${errorSection(outcome)}${explanation(outcome, warnings)}${checksSection(outcome)}${bodySection(outcome)}${logsSection(outcome)}${headersSection(outcome)}
</body></html>`;
}

function showPanel(title, html) {
  if (!panel) {
    panel = vscode.window.createWebviewPanel("gostman.response", title, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, { enableScripts: false, localResourceRoots: [] });
    panel.onDidDispose(() => {
      panel = undefined;
    });
  }
  panel.title = title;
  panel.webview.html = html;
  panel.reveal(undefined, true);
}

function sendArguments(reference, root) {
  return ["send", "--json", "--workspace", ".", "--max-body", String(PANEL_BODY_BYTES), "--include-headers", ...environmentArgs(root), "--", reference];
}

async function sendSaved(reference, cwd) {
  const title = vscode.l10n.t("Gostman: {0}", reference);
  const options = { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t("Sending {0}", reference), cancellable: true };
  await vscode.window.withProgress(options, async (_, token) => {
    const abort = new AbortController();
    token.onCancellationRequested(() => abort.abort());
    try {
      const { stdout, stderr } = await capture(sendArguments(reference, cwd), { cwd, signal: abort.signal });
      const outcome = parseOutcome(stdout);
      if (outcome) showPanel(title, renderOutcome(outcome, stderr.trim()));
      else vscode.window.showErrorMessage(vscode.l10n.t("Gostman: {0}", stderr.trim() || vscode.l10n.t("The send produced no result.")));
    } catch (error) {
      if (!abort.signal.aborted) vscode.window.showErrorMessage(vscode.l10n.t("Gostman: {0}", error.message));
    }
  });
}

async function sendFile(uri) {
  const target = uri ?? vscode.window.activeTextEditor?.document.uri;
  if (!target) return;
  const root = target.scheme === "file" ? collectionOf(target.fsPath)?.root : undefined;
  const document = await vscode.workspace.openTextDocument(target);
  if (document.isDirty) await document.save();
  const reference = root ? await requestReference(root, target.fsPath) : undefined;
  if (!reference) {
    vscode.window.showWarningMessage(vscode.l10n.t("Gostman: this file is not a request of the collection."));
    return;
  }
  await sendSaved(reference, root);
}

module.exports = { sendFile };
