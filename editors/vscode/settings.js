const vscode = require("vscode");
const { SETTINGS, ENVIRONMENT_CHOICES } = require("./constants");

let memory;

function settings() {
  return vscode.workspace.getConfiguration(SETTINGS.section);
}

function useMemory(state) {
  memory = state;
}

function storedChoices() {
  return memory?.get(ENVIRONMENT_CHOICES, {}) ?? {};
}

function configuredEnvironment() {
  return settings().get(SETTINGS.environment, "").trim();
}

function selectedEnvironment(root) {
  const stored = storedChoices();
  return root && Object.hasOwn(stored, root) ? stored[root] : configuredEnvironment();
}

async function chooseEnvironment(root, name) {
  await memory.update(ENVIRONMENT_CHOICES, { ...storedChoices(), [root]: name });
}

function environmentArgs(root) {
  const name = selectedEnvironment(root);
  return name ? ["--env", name] : [];
}

module.exports = { settings, useMemory, selectedEnvironment, chooseEnvironment, environmentArgs };
