const vscode = require("vscode");

const TERMINAL = "Gostman";
const DOCS_URL = "https://gostman.com/docs";

function settings() {
  return vscode.workspace.getConfiguration("gostman");
}

function quote(value) {
  return `"${String(value).replace(/(["\\$`])/g, "\\$1")}"`;
}

function rootFolder() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function terminal() {
  const existing = vscode.window.terminals.find((t) => t.name === TERMINAL && t.exitStatus === undefined);
  return existing ?? vscode.window.createTerminal({ name: TERMINAL, cwd: rootFolder() });
}

function envArgs() {
  const name = settings().get("environment", "").trim();
  return name ? ["--env", quote(name)] : [];
}

function execute(args) {
  const term = terminal();
  term.show(true);
  term.sendText([settings().get("path", "gostman"), ...args].join(" "));
}

function requireFolder() {
  const root = rootFolder();
  if (root) return root;
  vscode.window.showWarningMessage("Open a folder that holds a Gostman collection first.");
  return undefined;
}

async function ask(prompt, placeHolder) {
  const value = await vscode.window.showInputBox({ prompt, placeHolder, ignoreFocusOut: true });
  return value?.trim() || undefined;
}

function runCollection() {
  if (!requireFolder()) return;
  execute(["run", ".", ...envArgs()]);
}

async function runFolder() {
  if (!requireFolder()) return;
  const folder = await ask("Folder of the collection to run", "auth or auth/tokens");
  if (folder) execute(["run", ".", "--folder", quote(folder), ...envArgs()]);
}

async function sendRequest() {
  if (!requireFolder()) return;
  const request = await ask("Saved request: name, id or Folder/Name", "Users/List users");
  if (request) execute(["send", "--workspace", ".", ...envArgs(), quote(request)]);
}

async function runFlow() {
  if (!requireFolder()) return;
  const flow = await ask("Flow name", "checkout");
  if (flow) execute(["flow", "run", quote(flow), "--workspace", ".", ...envArgs()]);
}

function lintSpec(uri) {
  const target = uri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!target) {
    vscode.window.showWarningMessage("Select an OpenAPI file first.");
    return;
  }
  execute(["lint", quote(target)]);
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

const COMMANDS = {
  "gostman.run": runCollection,
  "gostman.runFolder": runFolder,
  "gostman.send": sendRequest,
  "gostman.flow": runFlow,
  "gostman.lint": lintSpec,
  "gostman.scan": scanCollection,
  "gostman.init": initCollection,
  "gostman.docs": openDocs,
};

function activate(context) {
  for (const [id, handler] of Object.entries(COMMANDS)) {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
