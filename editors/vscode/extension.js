const vscode = require("vscode");

const CONTROL = /\p{Cc}/u;
const DOCS_URL = "https://gostman.com/docs";

function settings() {
  return vscode.workspace.getConfiguration("gostman");
}

function rootFolder() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function envArgs() {
  const name = settings().get("environment", "").trim();
  return name ? ["--env", name] : [];
}

function execute(args) {
  const parts = args.filter(Boolean);
  if (parts.some((part) => CONTROL.test(part))) {
    vscode.window.showErrorMessage("Gostman: the value contains control characters.");
    return;
  }
  const execution = new vscode.ProcessExecution(settings().get("path", "gostman"), parts, { cwd: rootFolder() });
  const task = new vscode.Task({ type: "gostman" }, vscode.TaskScope.Workspace, "Gostman", "gostman", execution);
  task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, clear: true };
  vscode.tasks.executeTask(task);
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
  if (folder) execute(["run", ".", "--folder", folder, ...envArgs()]);
}

async function sendRequest() {
  if (!requireFolder()) return;
  const request = await ask("Saved request: name, id or Folder/Name", "Users/List users");
  if (request) execute(["send", "--workspace", ".", ...envArgs(), request]);
}

async function runFlow() {
  if (!requireFolder()) return;
  const flow = await ask("Flow name", "checkout");
  if (flow) execute(["flow", "run", flow, "--workspace", ".", ...envArgs()]);
}

function lintSpec(uri) {
  const target = uri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!target) {
    vscode.window.showWarningMessage("Select an OpenAPI file first.");
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
