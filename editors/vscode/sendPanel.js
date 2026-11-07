const vscode = require("vscode");
const { capture } = require("./cli");
const { environmentArgs } = require("./settings");
const { collectionOf } = require("./collections");
const { requestReference } = require("./workspaceFiles");
const { parseOutcome } = require("./report");
const { renderResponse } = require("./responseView");

const PANEL_BODY_BYTES = 256 * 1024;

function sendArguments(reference, root) {
  return ["send", "--json", "--workspace", ".", "--max-body", String(PANEL_BODY_BYTES), "--include-headers", ...environmentArgs(root), "--", reference];
}

function targetOf(argument) {
  if (argument instanceof vscode.Uri) return argument;
  if (typeof argument?.path === "string") return vscode.Uri.file(argument.path);
  return vscode.window.activeTextEditor?.document.uri;
}

function createSender(extensionUri) {
  const media = vscode.Uri.joinPath(extensionUri, "media");
  let panel;

  function openPanel() {
    if (panel) return panel;
    const options = { enableScripts: false, localResourceRoots: [media] };
    panel = vscode.window.createWebviewPanel("gostman.response", "Gostman", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, options);
    panel.iconPath = { light: vscode.Uri.joinPath(media, "mark-light.svg"), dark: vscode.Uri.joinPath(media, "mark-dark.svg") };
    panel.onDidDispose(() => {
      panel = undefined;
    });
    return panel;
  }

  function show(outcome, warnings) {
    const view = openPanel();
    const assets = { cspSource: view.webview.cspSource, styleUri: view.webview.asWebviewUri(vscode.Uri.joinPath(media, "response.css")) };
    view.title = vscode.l10n.t("Gostman: {0}", outcome.request || outcome.method);
    view.webview.html = renderResponse(outcome, warnings, assets);
    view.reveal(undefined, true);
  }

  async function sendSaved(reference, cwd) {
    const options = { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t("Sending {0}", reference), cancellable: true };
    await vscode.window.withProgress(options, async (_, token) => {
      const abort = new AbortController();
      token.onCancellationRequested(() => abort.abort());
      try {
        const { stdout, stderr } = await capture(sendArguments(reference, cwd), { cwd, signal: abort.signal });
        const outcome = parseOutcome(stdout);
        if (outcome) show(outcome, stderr.trim());
        else vscode.window.showErrorMessage(vscode.l10n.t("Gostman: {0}", stderr.trim() || vscode.l10n.t("The send produced no result.")));
      } catch (error) {
        if (!abort.signal.aborted) vscode.window.showErrorMessage(vscode.l10n.t("Gostman: {0}", error.message));
      }
    });
  }

  return async function sendFile(argument) {
    const target = targetOf(argument);
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
  };
}

module.exports = { createSender };
