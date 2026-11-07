const path = require("path");
const vscode = require("vscode");
const { selectedEnvironment, chooseEnvironment } = require("./settings");
const { listEnvironments } = require("./workspaceFiles");
const { collections } = require("./collections");
const { COMMANDS, SETTINGS } = require("./constants");

async function collectionNamed(root) {
  if (!root) return collections.choose();
  return (await collections.all()).find((collection) => path.relative(collection.root, root) === "") ?? collections.choose();
}

async function pickEnvironment(root) {
  const collection = await collectionNamed(typeof root === "string" ? root : undefined);
  if (!collection) return;
  const names = await listEnvironments(collection.root);
  if (names.length === 0) {
    vscode.window.showInformationMessage(vscode.l10n.t("This collection has no environments. Add a file to its environments folder."));
    return;
  }
  const current = selectedEnvironment(collection.root);
  const entries = [
    { label: vscode.l10n.t("Collection default"), description: vscode.l10n.t("The first environment, {0}", names[0]), value: "" },
    ...names.map((name) => ({ label: name, value: name })),
  ];
  const options = entries.map((entry) => ({ ...entry, detail: entry.value === current ? vscode.l10n.t("Selected") : undefined }));
  const placeHolder = vscode.l10n.t("Environment of {0}, passed to Gostman as --env", collection.label);
  const choice = await vscode.window.showQuickPick(options, { placeHolder });
  if (!choice) return;
  collections.remember(collection);
  await chooseEnvironment(collection.root, choice.value);
}

async function showSelection(item) {
  const several = (await collections.all()).length > 1;
  const collection = await collections.active();
  if (!collection) {
    item.hide();
    return;
  }
  const names = await listEnvironments(collection.root);
  const selected = selectedEnvironment(collection.root);
  const missing = selected !== "" && !names.includes(selected);
  const shown = selected || names[0] || vscode.l10n.t("No environment");
  const text = several ? vscode.l10n.t("{0}: {1}", collection.label, shown) : shown;
  item.text = `${missing ? "$(warning)" : "$(gostman-logo)"} ${text}`;
  item.tooltip = missing
    ? vscode.l10n.t("Gostman environment \"{0}\" is not in the environments folder of {1}. Select to change.", selected, collection.label)
    : vscode.l10n.t("Gostman environment of {0}. Select to change.", collection.label);
  item.backgroundColor = missing ? new vscode.ThemeColor("statusBarItem.warningBackground") : undefined;
  item.command = { command: COMMANDS.selectEnvironment, title: vscode.l10n.t("Select environment"), arguments: [collection.root] };
  item.show();
}

function activateEnvironment(context) {
  const item = vscode.window.createStatusBarItem("gostman.environment", vscode.StatusBarAlignment.Left, 50);
  item.name = vscode.l10n.t("Gostman environment");
  let pending = Promise.resolve();
  const refresh = () => {
    pending = pending.then(() => showSelection(item)).catch(() => undefined);
  };
  context.subscriptions.push(
    item,
    vscode.commands.registerCommand(COMMANDS.selectEnvironment, async (root) => {
      await pickEnvironment(root);
      refresh();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => event.affectsConfiguration(`${SETTINGS.section}.${SETTINGS.environment}`) && refresh()),
    collections.onDidChange(refresh),
    collections.onDidChangeCurrent(refresh),
    collections.onDidTouch(refresh),
  );
  refresh();
}

module.exports = { activateEnvironment };
