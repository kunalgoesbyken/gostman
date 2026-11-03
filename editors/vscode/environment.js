const vscode = require("vscode");
const { settings, rootFolder, requireFolder, selectedEnvironment } = require("./settings");
const { listEnvironments, ENVIRONMENTS } = require("./workspaceFiles");
const { watchCollection } = require("./watching");
const { COMMANDS, SETTINGS } = require("./constants");

async function pickEnvironment() {
  const root = requireFolder();
  if (!root) return;
  const names = await listEnvironments(root);
  if (names.length === 0) {
    vscode.window.showInformationMessage(vscode.l10n.t("This collection has no environments. Add a file to its environments folder."));
    return;
  }
  const current = selectedEnvironment();
  const entries = [
    { label: vscode.l10n.t("Collection default"), description: vscode.l10n.t("The first environment, {0}", names[0]), value: "" },
    ...names.map((name) => ({ label: name, value: name })),
  ];
  const options = entries.map((entry) => ({ ...entry, detail: entry.value === current ? vscode.l10n.t("Selected") : undefined }));
  const choice = await vscode.window.showQuickPick(options, { placeHolder: vscode.l10n.t("Environment passed to Gostman as --env") });
  if (choice) await settings().update(SETTINGS.environment, choice.value, vscode.ConfigurationTarget.Workspace);
}

async function showSelection(item) {
  const root = rootFolder();
  const names = root ? await listEnvironments(root) : [];
  const selected = selectedEnvironment();
  const missing = selected !== "" && !names.includes(selected);
  item.text = `${missing ? "$(warning)" : "$(server-environment)"} ${selected || names[0] || vscode.l10n.t("No environment")}`;
  item.tooltip = missing ? vscode.l10n.t("Gostman environment \"{0}\" is not in the collection's environments folder. Select to change.", selected) : vscode.l10n.t("Gostman environment. Select to change.");
  item.backgroundColor = missing ? new vscode.ThemeColor("statusBarItem.warningBackground") : undefined;
}

function activateEnvironment(context) {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  item.command = COMMANDS.selectEnvironment;
  const refresh = () => showSelection(item);
  context.subscriptions.push(
    item,
    vscode.commands.registerCommand(COMMANDS.selectEnvironment, pickEnvironment),
    vscode.workspace.onDidChangeConfiguration((event) => event.affectsConfiguration(`${SETTINGS.section}.${SETTINGS.environment}`) && refresh()),
  );
  watchCollection(context, `${ENVIRONMENTS}/*`, refresh);
  refresh();
  item.show();
}

module.exports = { activateEnvironment };
