const vscode = require("vscode");
const { rootFolder } = require("./settings");

function watchCollection(context, pattern, onChange) {
  let watcher;
  const start = () => {
    watcher?.dispose();
    watcher = undefined;
    const root = rootFolder();
    if (!root) return;
    watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, pattern));
    watcher.onDidCreate(onChange);
    watcher.onDidChange(onChange);
    watcher.onDidDelete(onChange);
  };
  start();
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      start();
      onChange();
    }),
    { dispose: () => watcher?.dispose() },
  );
}

module.exports = { watchCollection };
