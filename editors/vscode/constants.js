const COMMANDS = {
  run: "gostman.run",
  runFolder: "gostman.runFolder",
  send: "gostman.send",
  sendFile: "gostman.sendFile",
  flow: "gostman.flow",
  lint: "gostman.lint",
  scan: "gostman.scan",
  init: "gostman.init",
  docs: "gostman.docs",
  selectEnvironment: "gostman.selectEnvironment",
};

const SETTINGS = {
  section: "gostman",
  path: "path",
  environment: "environment",
};

const MANIFEST = "gostman.yaml";
const YAML_GLOB = "**/*.{yaml,yml}";
const SEARCH_DEPTH = 4;
const SEARCH_FOLDER_LIMIT = 5000;
const SKIPPED_FOLDERS = ["node_modules", "bower_components", "vendor", "__pycache__"];
const ENVIRONMENT_CHOICES = "gostman.environmentChoices";

module.exports = { COMMANDS, SETTINGS, MANIFEST, YAML_GLOB, SEARCH_DEPTH, SEARCH_FOLDER_LIMIT, SKIPPED_FOLDERS, ENVIRONMENT_CHOICES };
