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

module.exports = { COMMANDS, SETTINGS, MANIFEST, YAML_GLOB };
