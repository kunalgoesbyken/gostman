const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const { entriesOf } = require("./workspaceFiles");
const { MANIFEST, YAML_GLOB, SEARCH_DEPTH, SEARCH_FOLDER_LIMIT, SKIPPED_FOLDERS } = require("./constants");

const SKIPPED = new Set(SKIPPED_FOLDERS);

function isSkipped(name) {
  return name.startsWith(".") || SKIPPED.has(name.toLowerCase());
}

function hasManifest(directory) {
  try {
    return fs.statSync(path.join(directory, MANIFEST)).isFile();
  } catch {
    return false;
  }
}

function holdsManifest(entries) {
  return entries.some((entry) => entry.isFile() && entry.name === MANIFEST);
}

function subfolders(directory, entries) {
  return entries.filter((entry) => entry.isDirectory() && !isSkipped(entry.name)).map((entry) => path.join(directory, entry.name));
}

async function searchFolder(top) {
  const found = [];
  let level = [top];
  let budget = SEARCH_FOLDER_LIMIT;
  for (let depth = 0; depth <= SEARCH_DEPTH && level.length > 0 && budget > 0; depth++) {
    const batch = level.slice(0, budget);
    budget -= batch.length;
    const listed = await Promise.all(batch.map(async (directory) => ({ directory, entries: await entriesOf(directory) })));
    level = [];
    for (const { directory, entries } of listed) {
      if (holdsManifest(entries)) found.push(directory);
      else if (depth < SEARCH_DEPTH) level.push(...subfolders(directory, entries));
    }
  }
  return found;
}

function labelOf(folder, root) {
  const relative = path.relative(folder.uri.fsPath, root);
  return relative === "" ? folder.name : [folder.name, ...relative.split(path.sep)].join("/");
}

function describe(folder, root) {
  return { root, folder, label: labelOf(folder, root) };
}

function partsWithin(parent, child) {
  const relative = path.relative(parent, child);
  if (relative === "") return [];
  if (path.isAbsolute(relative) || relative.split(path.sep)[0] === "..") return undefined;
  return relative.split(path.sep);
}

function localFolders() {
  return (vscode.workspace.workspaceFolders ?? []).filter((folder) => folder.uri.scheme === "file");
}

function collectionOf(file) {
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file));
  if (!folder) return undefined;
  const top = folder.uri.fsPath;
  const parts = partsWithin(top, path.dirname(file));
  if (!parts || parts.some(isSkipped)) return undefined;
  for (let count = parts.length; count >= 0; count--) {
    const directory = path.join(top, ...parts.slice(0, count));
    if (hasManifest(directory)) return describe(folder, directory);
  }
  return undefined;
}

function compareCollections(first, second) {
  if (first.folder.index !== second.folder.index) return first.folder.index - second.folder.index;
  return first.root < second.root ? -1 : first.root > second.root ? 1 : 0;
}

function createCollections() {
  const changed = new vscode.EventEmitter();
  const touched = new vscode.EventEmitter();
  const currentChanged = new vscode.EventEmitter();
  let found;
  let known = [];
  let current;
  let watchers = [];

  async function discover() {
    const lists = await Promise.all(localFolders().map(async (folder) => (await searchFolder(folder.uri.fsPath)).map((root) => describe(folder, root))));
    known = lists.flat().sort(compareCollections);
    return known;
  }

  function all() {
    found ??= discover();
    return found;
  }

  function reset() {
    found = undefined;
    changed.fire();
  }

  function onYaml(uri) {
    if (path.basename(uri.fsPath) === MANIFEST) {
      reset();
      return;
    }
    const collection = collectionOf(uri.fsPath);
    if (collection) touched.fire();
  }

  function onCreated(uri) {
    if (hasManifest(uri.fsPath)) reset();
  }

  function onDeleted(uri) {
    if (known.some((collection) => partsWithin(uri.fsPath, collection.root))) reset();
  }

  function watchFolder(folder) {
    const yaml = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, YAML_GLOB));
    yaml.onDidCreate(onYaml);
    yaml.onDidChange(onYaml);
    yaml.onDidDelete(onYaml);
    const moves = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "**"), false, true, false);
    moves.onDidCreate(onCreated);
    moves.onDidDelete(onDeleted);
    return [yaml, moves];
  }

  function watch() {
    watchers.forEach((watcher) => watcher.dispose());
    watchers = localFolders().flatMap(watchFolder);
  }

  function remember(collection) {
    if (!collection || collection.root === current) return;
    current = collection.root;
    currentChanged.fire();
  }

  function followEditor(editor) {
    if (editor?.document.uri.scheme === "file") remember(collectionOf(editor.document.uri.fsPath));
  }

  async function active() {
    const list = await all();
    return list.find((collection) => collection.root === current) ?? list[0];
  }

  async function choose() {
    const list = await all();
    if (list.length === 0) {
      vscode.window.showWarningMessage(vscode.l10n.t("Open a folder that holds a Gostman collection first."));
      return undefined;
    }
    if (list.length === 1) return list[0];
    const file = vscode.window.activeTextEditor?.document.uri;
    const editorCollection = file?.scheme === "file" ? collectionOf(file.fsPath) : undefined;
    const match = editorCollection && list.find((collection) => collection.root === editorCollection.root);
    if (match) return match;
    const items = list.map((collection) => ({ label: collection.label, description: collection.root === current ? vscode.l10n.t("Current") : undefined, collection }));
    const picked = await vscode.window.showQuickPick(items, { placeHolder: vscode.l10n.t("Gostman collection") });
    remember(picked?.collection);
    return picked?.collection;
  }

  function activate(context) {
    watch();
    followEditor(vscode.window.activeTextEditor);
    context.subscriptions.push(
      changed,
      touched,
      currentChanged,
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        watch();
        reset();
      }),
      vscode.window.onDidChangeActiveTextEditor(followEditor),
      { dispose: () => watchers.forEach((watcher) => watcher.dispose()) },
    );
  }

  return {
    all,
    active,
    choose,
    remember,
    activate,
    onDidChange: changed.event,
    onDidTouch: touched.event,
    onDidChangeCurrent: currentChanged.event,
  };
}

const collections = createCollections();

module.exports = { collections, collectionOf, localFolders };
