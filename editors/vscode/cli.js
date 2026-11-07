const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const vscode = require("vscode");
const { settings } = require("./settings");
const { logStart, logEnd, logError } = require("./output");
const { SETTINGS } = require("./constants");

const CONTROL = /\p{Cc}/u;
const OUTPUT_LIMIT = 64 * 1024 * 1024;
const DEFAULT_COMMAND = "gostman";
const WINDOWS = process.platform === "win32";
const EXECUTABLE = WINDOWS ? `${DEFAULT_COMMAND}.exe` : DEFAULT_COMMAND;

function isExecutable(file) {
  try {
    if (!fs.statSync(file).isFile()) return false;
    if (!WINDOWS) fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function listed(value) {
  return (value ?? "").split(path.delimiter).filter(Boolean);
}

function onPath() {
  const names = WINDOWS ? [EXECUTABLE, `${DEFAULT_COMMAND}.com`] : [DEFAULT_COMMAND];
  return listed(process.env.PATH ?? process.env.Path).some((directory) => names.some((name) => isExecutable(path.join(directory, name))));
}

function installPlaces() {
  const home = os.homedir();
  const goPaths = listed(process.env.GOPATH).map((directory) => path.join(directory, "bin"));
  const common = WINDOWS ? [] : ["/opt/homebrew/bin", "/usr/local/bin", path.join(home, ".local", "bin")];
  return [process.env.GOBIN, ...goPaths, path.join(home, "go", "bin"), ...common].filter(Boolean);
}

function cliPath() {
  const configured = settings().get(SETTINGS.path, DEFAULT_COMMAND).trim() || DEFAULT_COMMAND;
  if (configured !== DEFAULT_COMMAND || onPath()) return configured;
  return installPlaces().map((directory) => path.join(directory, EXECUTABLE)).find(isExecutable) ?? configured;
}

function present(args) {
  return args.filter(Boolean);
}

function startFailure(error, command) {
  if (error.code === "ENOENT") return new Error(vscode.l10n.t("Could not start \"{0}\". Install the Gostman CLI or set gostman.path.", command));
  return error;
}

function hasControl(parts) {
  if (!parts.some((part) => CONTROL.test(part))) return false;
  vscode.window.showErrorMessage(vscode.l10n.t("Gostman: the value contains control characters."));
  return true;
}

function execute(args, { cwd, scope, name }) {
  const parts = present(args);
  if (hasControl(parts)) return;
  const command = cliPath();
  logStart(command, parts, cwd);
  const execution = new vscode.ProcessExecution(command, parts, { cwd });
  const task = new vscode.Task({ type: "gostman" }, scope ?? vscode.TaskScope.Workspace, name ?? "Gostman", "gostman", execution);
  task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, clear: true };
  vscode.tasks.executeTask(task).then(undefined, (error) => vscode.window.showErrorMessage(vscode.l10n.t("Gostman: {0}", startFailure(error, command).message)));
}

function capture(args, { cwd, signal }) {
  const command = cliPath();
  const parts = present(args);
  logStart(command, parts, cwd);
  return new Promise((resolve, reject) => {
    const options = { cwd, signal, maxBuffer: OUTPUT_LIMIT, windowsHide: true, encoding: "utf8" };
    execFile(command, parts, options, (error, stdout, stderr) => {
      if (error && typeof error.code !== "number") {
        const failure = startFailure(error, command);
        logError(failure.message);
        reject(failure);
        return;
      }
      const code = error ? error.code : 0;
      logEnd(code, stderr);
      resolve({ code, stdout, stderr });
    });
  });
}

module.exports = { execute, capture };
