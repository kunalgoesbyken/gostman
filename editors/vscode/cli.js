const { execFile } = require("child_process");
const vscode = require("vscode");
const { settings, rootFolder } = require("./settings");
const { SETTINGS } = require("./constants");

const CONTROL = /\p{Cc}/u;
const OUTPUT_LIMIT = 64 * 1024 * 1024;

function cliPath() {
  return settings().get(SETTINGS.path, "gostman");
}

function present(args) {
  return args.filter(Boolean);
}

function startFailure(error) {
  if (error.code === "ENOENT") return new Error(vscode.l10n.t("Could not start \"{0}\". Install the Gostman CLI or set gostman.path.", cliPath()));
  return error;
}

function execute(args) {
  const parts = present(args);
  if (parts.some((part) => CONTROL.test(part))) {
    vscode.window.showErrorMessage(vscode.l10n.t("Gostman: the value contains control characters."));
    return;
  }
  const execution = new vscode.ProcessExecution(cliPath(), parts, { cwd: rootFolder() });
  const task = new vscode.Task({ type: "gostman" }, vscode.TaskScope.Workspace, "Gostman", "gostman", execution);
  task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, clear: true };
  vscode.tasks.executeTask(task);
}

function capture(args, { cwd, signal }) {
  return new Promise((resolve, reject) => {
    const options = { cwd, signal, maxBuffer: OUTPUT_LIMIT, windowsHide: true, encoding: "utf8" };
    execFile(cliPath(), present(args), options, (error, stdout, stderr) => {
      if (error && typeof error.code !== "number") {
        reject(startFailure(error));
        return;
      }
      resolve({ code: error ? error.code : 0, stdout, stderr });
    });
  });
}

module.exports = { execute, capture };
