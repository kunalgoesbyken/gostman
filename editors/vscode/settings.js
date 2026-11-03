const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const { SETTINGS, MANIFEST } = require("./constants");

function settings() {
  return vscode.workspace.getConfiguration(SETTINGS.section);
}

function hasManifest(folderPath) {
  return fs.existsSync(path.join(folderPath, MANIFEST));
}

function rootFolder() {
  const folders = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
  return folders.find(hasManifest) ?? folders[0];
}

function rootFor(uri) {
  const folder = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
  return folder && hasManifest(folder) ? folder : undefined;
}

function requireFolder() {
  const root = rootFolder();
  if (root) return root;
  vscode.window.showWarningMessage(vscode.l10n.t("Open a folder that holds a Gostman collection first."));
  return undefined;
}

function selectedEnvironment() {
  return settings().get(SETTINGS.environment, "").trim();
}

function environmentArgs() {
  const name = selectedEnvironment();
  return name ? ["--env", name] : [];
}

module.exports = { settings, rootFolder, rootFor, requireFolder, selectedEnvironment, environmentArgs };
