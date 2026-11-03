const vscode = require("vscode");

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseReport(stdout) {
  const report = parseJson(stdout);
  return Array.isArray(report?.results) ? report : undefined;
}

function parseOutcome(stdout) {
  const outcome = parseJson(stdout);
  return typeof outcome?.method === "string" && outcome.body ? outcome : undefined;
}

function describeCheck(check) {
  return check.message ? vscode.l10n.t("{0}: {1}", check.name, check.message) : check.name;
}

function describeFailure(result) {
  const failedChecks = (result.tests ?? []).filter((check) => !check.passed).map(describeCheck);
  return [result.error, result.failure, ...failedChecks].filter(Boolean).join("\n");
}

function verdict(results) {
  const duration = results.reduce((total, result) => total + (result.durationMs ?? 0), 0);
  const failed = results.filter((result) => result.failed);
  if (failed.length > 0) {
    const message = failed.map(describeFailure).filter(Boolean).join("\n");
    return { state: "failed", message: message || vscode.l10n.t("The request failed."), duration };
  }
  if (results.every((result) => result.skipped)) return { state: "skipped", duration };
  return { state: "passed", duration };
}

function resultLine(result) {
  const name = result.folder ? `${result.folder}/${result.name}` : result.name;
  const duration = result.durationMs ?? 0;
  if (result.skipped) return vscode.l10n.t("Skipped {0} ({1} ms)", name, duration);
  if (result.failed) return vscode.l10n.t("Failed {0} ({1} ms)", name, duration);
  return vscode.l10n.t("Passed {0} ({1} ms)", name, duration);
}

module.exports = { parseReport, parseOutcome, describeCheck, verdict, resultLine };
