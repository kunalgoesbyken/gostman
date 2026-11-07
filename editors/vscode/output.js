const vscode = require("vscode");

let channel;

function activateOutput(context) {
  channel = vscode.window.createOutputChannel("Gostman", { log: true });
  context.subscriptions.push(channel);
}

function quoted(part) {
  return part === "" || /\s/.test(part) ? JSON.stringify(part) : part;
}

function logStart(command, args, cwd) {
  channel?.info(`${[command, ...args].map(quoted).join(" ")}  (${cwd})`);
}

function logEnd(code, stderr) {
  const text = stderr.trim();
  if (text) channel?.warn(text);
  channel?.info(vscode.l10n.t("Exit code {0}", code));
}

function logError(message) {
  channel?.error(message);
}

module.exports = { activateOutput, logStart, logEnd, logError };
