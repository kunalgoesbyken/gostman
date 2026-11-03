const vscode = require("vscode");
const { rootFor } = require("./settings");
const { isRequestText, belongsTo } = require("./workspaceFiles");
const { COMMANDS, YAML_GLOB } = require("./constants");

const SELECTOR = { scheme: "file", pattern: YAML_GLOB };

const provider = {
  provideCodeLenses(document) {
    const root = rootFor(document.uri);
    if (!root || !belongsTo(root, document.uri.fsPath) || !isRequestText(document.getText())) return [];
    const top = new vscode.Range(0, 0, 0, 0);
    return [new vscode.CodeLens(top, { title: vscode.l10n.t("Send"), command: COMMANDS.sendFile, arguments: [document.uri] })];
  },
};

function activateLenses(context) {
  context.subscriptions.push(vscode.languages.registerCodeLensProvider(SELECTOR, provider));
}

module.exports = { activateLenses };
