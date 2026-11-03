const fs = require("fs");
const path = require("path");
const { isYamlFile, readValues } = require("./yamlValues");
const { MANIFEST } = require("./constants");

const FOLDER_FILE = "folder.yaml";
const ENVIRONMENTS = "environments";
const REFERENCE_SEPARATOR = "/";
const REQUEST_MARKERS = ["method", "url"];
const REQUEST_KEYS = ["id", "name", "order", ...REQUEST_MARKERS];

function isHidden(name) {
  return name.startsWith(".");
}

function stemOf(name) {
  return path.basename(name, path.extname(name));
}

function compareByOrder(first, second) {
  const firstOrdered = first.order > 0;
  if (firstOrdered !== second.order > 0) return firstOrdered ? -1 : 1;
  if (first.order !== second.order) return first.order - second.order;
  if (first.path === second.path) return 0;
  return first.path < second.path ? -1 : 1;
}

async function entriesOf(directory) {
  try {
    return await fs.promises.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function valuesOf(file, keys) {
  try {
    return readValues(await fs.promises.readFile(file, "utf8"), keys);
  } catch {
    return new Map();
  }
}

function orderOf(values) {
  return Number(values.get("order")) || 0;
}

function isRequest(values) {
  return REQUEST_MARKERS.some((key) => values.has(key));
}

function isRequestText(text) {
  return isRequest(readValues(text, REQUEST_MARKERS));
}

function belongsTo(root, file) {
  const relative = path.relative(root, file);
  if (relative === "" || path.isAbsolute(relative)) return false;
  return relative.split(path.sep).every((part) => part !== ".." && !isHidden(part));
}

async function listEnvironments(root) {
  const directory = path.join(root, ENVIRONMENTS);
  const files = (await entriesOf(directory)).filter((entry) => entry.isFile() && !isHidden(entry.name) && isYamlFile(entry.name));
  const environments = await Promise.all(
    files.map(async (entry) => {
      const values = await valuesOf(path.join(directory, entry.name), ["name", "order"]);
      return { name: values.get("name") || stemOf(entry.name), order: orderOf(values), path: entry.name };
    }),
  );
  return environments.sort(compareByOrder).map((environment) => environment.name);
}

function requestNode(file, values, folderNames) {
  const name = values.get("name") || stemOf(file);
  const id = values.get("id");
  const qualified = [...folderNames, name].join(REFERENCE_SEPARATOR);
  return { kind: "request", path: file, name, id, qualified, reference: id || qualified, order: orderOf(values) };
}

async function readRequest(file, folderNames) {
  const values = await valuesOf(file, REQUEST_KEYS);
  return isRequest(values) ? requestNode(file, values, folderNames) : undefined;
}

function isReserved(entry, atRoot) {
  const name = entry.name.toLowerCase();
  if (isHidden(name) || name === FOLDER_FILE) return true;
  return atRoot && (name === MANIFEST || name === ENVIRONMENTS);
}

async function readEntry(entry, directory, folderNames) {
  const full = path.join(directory, entry.name);
  if (entry.isDirectory()) return readSubfolder(full, folderNames);
  return entry.isFile() && isYamlFile(entry.name) ? readRequest(full, folderNames) : undefined;
}

async function readFolder(directory, folderNames, atRoot) {
  const children = (await entriesOf(directory)).filter((entry) => !isReserved(entry, atRoot));
  const nodes = (await Promise.all(children.map((entry) => readEntry(entry, directory, folderNames)))).filter(Boolean);
  const ordered = (kind) => nodes.filter((node) => node.kind === kind).sort(compareByOrder);
  return [...ordered("folder"), ...ordered("request")];
}

async function readSubfolder(directory, parentNames) {
  const values = await valuesOf(path.join(directory, FOLDER_FILE), ["name", "order"]);
  const names = [...parentNames, values.get("name") || path.basename(directory)];
  const children = await readFolder(directory, names, false);
  if (children.length === 0) return undefined;
  return { kind: "folder", path: directory, name: names[names.length - 1], reference: names.join(REFERENCE_SEPARATOR), order: orderOf(values), children };
}

function requestsOf(nodes) {
  return nodes.flatMap((node) => (node.kind === "folder" ? requestsOf(node.children) : [node]));
}

function withoutSharedIds(tree) {
  const requests = requestsOf(tree);
  const uses = new Map();
  requests.forEach((request) => request.id && uses.set(request.id, (uses.get(request.id) ?? 0) + 1));
  for (const request of requests) {
    if (uses.get(request.id) > 1) Object.assign(request, { id: undefined, reference: request.qualified });
  }
  return tree;
}

async function readCollection(root) {
  return withoutSharedIds(await readFolder(root, [], true));
}

async function requestReference(root, file) {
  const found = requestsOf(await readCollection(root)).find((request) => path.relative(request.path, file) === "");
  return found?.reference;
}

module.exports = { listEnvironments, readCollection, requestReference, isRequestText, belongsTo, ENVIRONMENTS, REFERENCE_SEPARATOR };
