const vscode = require("vscode");
const { readTree } = require("./collectionTree");
const { collections } = require("./collections");
const { methodTone } = require("./tones");

const VIEW_ID = "gostman.requests";
const MUTED_COLOR = "descriptionForeground";
const CONTAINER_ICONS = { collection: "library", folder: "folder" };

function toneColor(tone) {
  return new vscode.ThemeColor(tone === "muted" ? MUTED_COLOR : `gostman.${tone}`);
}

function requestItem(node) {
  const uri = vscode.Uri.file(node.path);
  const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
  item.description = node.method;
  item.tooltip = node.qualified;
  item.iconPath = new vscode.ThemeIcon("circle-filled", toneColor(methodTone(node.method)));
  item.command = { command: "vscode.open", title: vscode.l10n.t("Open"), arguments: [uri] };
  item.contextValue = "request";
  return item;
}

function containerItem(node) {
  const state = node.kind === "collection" ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
  const item = new vscode.TreeItem(node.name, state);
  item.id = node.path;
  item.iconPath = new vscode.ThemeIcon(CONTAINER_ICONS[node.kind]);
  item.contextValue = node.kind;
  return item;
}

function activateRequestsView(context) {
  const changed = new vscode.EventEmitter();
  const provider = {
    onDidChangeTreeData: changed.event,
    getTreeItem: (node) => (node.kind === "request" ? requestItem(node) : containerItem(node)),
    getChildren: (node) => (node ? node.children : readTree()),
  };
  const refresh = () => changed.fire();
  context.subscriptions.push(changed, vscode.window.registerTreeDataProvider(VIEW_ID, provider), collections.onDidChange(refresh), collections.onDidTouch(refresh));
}

module.exports = { activateRequestsView };
