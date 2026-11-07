const vscode = require("vscode");
const { collectionOf, collections } = require("./collections");
const { isRequestText } = require("./workspaceFiles");
const { COMMANDS, YAML_GLOB } = require("./constants");

const SELECTOR = { scheme: "file", pattern: YAML_GLOB };

function createProvider() {
  const changed = new vscode.EventEmitter();
  const provider = {
    onDidChangeCodeLenses: changed.event,
    provideCodeLenses(document) {
      const collection = collectionOf(document.uri.fsPath);
      if (!collection || !isRequestText(document.getText())) return [];
      const top = new vscode.Range(0, 0, 0, 0);
      return [new vscode.CodeLens(top, { title: vscode.l10n.t("Send"), command: COMMANDS.sendFile, arguments: [document.uri] })];
    },
  };
  return { provider, changed };
}

function activateLenses(context) {
  const { provider, changed } = createProvider();
  context.subscriptions.push(changed, vscode.languages.registerCodeLensProvider(SELECTOR, provider), collections.onDidChange(() => changed.fire()));
}

module.exports = { activateLenses };
