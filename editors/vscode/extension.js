const path = require("path");
const vscode = require("vscode");
const { execute } = require("./cli");
const { environmentArgs, useMemory } = require("./settings");
const { collections, localFolders } = require("./collections");
const { activateEnvironment } = require("./environment");
const { activateLenses } = require("./lenses");
const { activateTesting } = require("./testing");
const { createSender } = require("./sendPanel");
const { activateRequestsView } = require("./requestsView");
const { activateOutput } = require("./output");
const { COMMANDS } = require("./constants");

const DOCS_URL = "https://gostman.com/docs";

async function ask(prompt, placeHolder) {
  const value = await vscode.window.showInputBox({ prompt, placeHolder, ignoreFocusOut: true });
  return value?.trim() || undefined;
}

function inCollection(collection, args) {
  execute(args, { cwd: collection.root, scope: collection.folder, name: vscode.l10n.t("Gostman: {0}", collection.label) });
}

async function runCollection() {
  const collection = await collections.choose();
  if (collection) inCollection(collection, ["run", ".", ...environmentArgs(collection.root)]);
}

async function runFolder() {
  const collection = await collections.choose();
  if (!collection) return;
  const folder = await ask(vscode.l10n.t("Folder of {0} to run", collection.label), vscode.l10n.t("auth or auth/tokens"));
  if (folder) inCollection(collection, ["run", ".", "--folder", folder, ...environmentArgs(collection.root)]);
}

async function sendRequest() {
  const collection = await collections.choose();
  if (!collection) return;
  const request = await ask(vscode.l10n.t("Saved request of {0}: name, id or Folder/Name", collection.label), vscode.l10n.t("Users/List users"));
  if (request) inCollection(collection, ["send", "--workspace", ".", ...environmentArgs(collection.root), "--", request]);
}

async function runFlow() {
  const collection = await collections.choose();
  if (!collection) return;
  const flow = await ask(vscode.l10n.t("Flow of {0}", collection.label), vscode.l10n.t("checkout"));
  if (flow) inCollection(collection, ["flow", "run", flow, "--workspace", ".", ...environmentArgs(collection.root)]);
}

function lintSpec(uri) {
  const target = uri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!target) {
    vscode.window.showWarningMessage(vscode.l10n.t("Select an OpenAPI file first."));
    return;
  }
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(target));
  execute(["lint", target], { cwd: path.dirname(target), scope: folder });
}

async function scanCollection() {
  const collection = await collections.choose();
  if (collection) inCollection(collection, ["scan", "."]);
}

async function pickFolder() {
  const folders = localFolders();
  if (folders.length <= 1) return folders[0];
  return vscode.window.showWorkspaceFolderPick({ placeHolder: vscode.l10n.t("Folder to create the collection in") });
}

async function initCollection() {
  const folder = await pickFolder();
  if (!folder) {
    vscode.window.showWarningMessage(vscode.l10n.t("Open a folder first."));
    return;
  }
  execute(["init", "."], { cwd: folder.uri.fsPath, scope: folder });
}

function openDocs() {
  vscode.env.openExternal(vscode.Uri.parse(DOCS_URL));
}

const HANDLERS = {
  [COMMANDS.run]: runCollection,
  [COMMANDS.runFolder]: runFolder,
  [COMMANDS.send]: sendRequest,
  [COMMANDS.flow]: runFlow,
  [COMMANDS.lint]: lintSpec,
  [COMMANDS.scan]: scanCollection,
  [COMMANDS.init]: initCollection,
  [COMMANDS.docs]: openDocs,
};

function activate(context) {
  useMemory(context.workspaceState);
  activateOutput(context);
  collections.activate(context);
  const handlers = { ...HANDLERS, [COMMANDS.sendFile]: createSender(context.extensionUri) };
  for (const [id, handler] of Object.entries(handlers)) {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));
  }
  activateEnvironment(context);
  activateLenses(context);
  activateTesting(context);
  activateRequestsView(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
