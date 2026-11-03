const vscode = require("vscode");
const { execute } = require("./cli");
const { environmentArgs, requireFolder } = require("./settings");
const { activateEnvironment } = require("./environment");
const { activateLenses } = require("./lenses");
const { activateTesting } = require("./testing");
const { sendFile } = require("./sendPanel");
const { COMMANDS } = require("./constants");

const DOCS_URL = "https://gostman.com/docs";

async function ask(prompt, placeHolder) {
  const value = await vscode.window.showInputBox({ prompt, placeHolder, ignoreFocusOut: true });
  return value?.trim() || undefined;
}

function runCollection() {
  if (!requireFolder()) return;
  execute(["run", ".", ...environmentArgs()]);
}

async function runFolder() {
  if (!requireFolder()) return;
  const folder = await ask(vscode.l10n.t("Folder of the collection to run"), vscode.l10n.t("auth or auth/tokens"));
  if (folder) execute(["run", ".", "--folder", folder, ...environmentArgs()]);
}

async function sendRequest() {
  if (!requireFolder()) return;
  const request = await ask(vscode.l10n.t("Saved request: name, id or Folder/Name"), vscode.l10n.t("Users/List users"));
  if (request) execute(["send", "--workspace", ".", ...environmentArgs(), request]);
}

async function runFlow() {
  if (!requireFolder()) return;
  const flow = await ask(vscode.l10n.t("Flow name"), vscode.l10n.t("checkout"));
  if (flow) execute(["flow", "run", flow, "--workspace", ".", ...environmentArgs()]);
}

function lintSpec(uri) {
  const target = uri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!target) {
    vscode.window.showWarningMessage(vscode.l10n.t("Select an OpenAPI file first."));
    return;
  }
  execute(["lint", target]);
}

function scanCollection() {
  if (!requireFolder()) return;
  execute(["scan", "."]);
}

function initCollection() {
  if (!requireFolder()) return;
  execute(["init", "."]);
}

function openDocs() {
  vscode.env.openExternal(vscode.Uri.parse(DOCS_URL));
}

const HANDLERS = {
  [COMMANDS.run]: runCollection,
  [COMMANDS.runFolder]: runFolder,
  [COMMANDS.send]: sendRequest,
  [COMMANDS.sendFile]: sendFile,
  [COMMANDS.flow]: runFlow,
  [COMMANDS.lint]: lintSpec,
  [COMMANDS.scan]: scanCollection,
  [COMMANDS.init]: initCollection,
  [COMMANDS.docs]: openDocs,
};

function activate(context) {
  for (const [id, handler] of Object.entries(HANDLERS)) {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));
  }
  activateEnvironment(context);
  activateLenses(context);
  activateTesting(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
