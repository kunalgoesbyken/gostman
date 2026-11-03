const vscode = require("vscode");
const { capture } = require("./cli");
const { environmentArgs, rootFolder } = require("./settings");
const { readCollection, REFERENCE_SEPARATOR } = require("./workspaceFiles");
const { watchCollection } = require("./watching");
const { YAML_GLOB } = require("./constants");
const { parseReport, verdict, resultLine } = require("./report");

const REFRESH_DELAY_MS = 300;

function itemsOf(collection) {
  const found = [];
  collection.forEach((item) => found.push(item));
  return found;
}

function createTesting() {
  const controller = vscode.tests.createTestController("gostman", "Gostman");
  const nodes = new WeakMap();
  let loaded = false;
  let queue = Promise.resolve();

  function sync(collection, list) {
    const items = list.map((node, index) => {
      const item = collection.get(node.path) ?? controller.createTestItem(node.path, node.name, vscode.Uri.file(node.path));
      item.label = node.name;
      item.sortText = String(index).padStart(6, "0");
      nodes.set(item, node);
      if (node.kind === "folder") sync(item.children, node.children);
      return item;
    });
    collection.replace(items);
  }

  async function refreshItems() {
    loaded = true;
    const root = rootFolder();
    sync(controller.items, root ? await readCollection(root) : []);
  }

  function rebuild() {
    queue = queue.then(refreshItems);
    return queue;
  }

  function leaves(item, excluded) {
    if (excluded.has(item)) return [];
    if (nodes.get(item).kind === "request") return [item];
    return itemsOf(item.children).flatMap((child) => leaves(child, excluded));
  }

  function plan(request) {
    const excluded = new Set(request.exclude ?? []);
    const included = request.include ?? itemsOf(controller.items);
    const items = [...new Set(included.flatMap((item) => leaves(item, excluded)))];
    if (!request.include && excluded.size === 0) return { selection: [], items };
    const wholeFolder = included.length === 1 && excluded.size === 0 && nodes.get(included[0]).kind === "folder";
    const selection = wholeFolder ? ["--folder", nodes.get(included[0]).reference] : items.flatMap((item) => ["--only", nodes.get(item).reference]);
    return { selection, items };
  }

  function lookups(items) {
    const byId = new Map();
    const byName = new Map();
    for (const item of items) {
      const node = nodes.get(item);
      if (node.id) byId.set(node.id, item);
      byName.set(node.qualified, item);
    }
    return (result) => byId.get(result.id) ?? byName.get(result.folder ? `${result.folder}${REFERENCE_SEPARATOR}${result.name}` : result.name);
  }

  function report(run, items, results) {
    const find = lookups(items);
    const grouped = new Map();
    for (const result of results) {
      const item = find(result);
      if (item) grouped.set(item, [...(grouped.get(item) ?? []), result]);
    }
    for (const item of items) {
      const found = grouped.get(item);
      if (!found) {
        run.skipped(item);
        continue;
      }
      const outcome = verdict(found);
      if (outcome.state === "failed") run.failed(item, new vscode.TestMessage(outcome.message), outcome.duration);
      else if (outcome.state === "skipped") run.skipped(item);
      else run.passed(item, outcome.duration);
    }
    for (const result of results) run.appendOutput(`${resultLine(result)}\r\n`);
  }

  function fail(run, items, text) {
    for (const item of items) run.errored(item, new vscode.TestMessage(text));
  }

  async function execute(run, { selection, items }, signal) {
    if (items.length === 0) return;
    items.forEach((item) => run.started(item));
    try {
      const args = ["run", ".", ...selection, ...environmentArgs(), "--redact", "--reporter", "json"];
      const { stdout, stderr } = await capture(args, { cwd: rootFolder(), signal });
      const parsed = parseReport(stdout);
      if (parsed) report(run, items, parsed.results);
      else fail(run, items, stderr.trim() || vscode.l10n.t("The run produced no report."));
    } catch (error) {
      if (!signal.aborted) fail(run, items, error.message);
    }
  }

  async function runTests(request, token) {
    const run = controller.createTestRun(request);
    const abort = new AbortController();
    token.onCancellationRequested(() => abort.abort());
    try {
      await execute(run, plan(request), abort.signal);
    } finally {
      run.end();
    }
  }

  controller.resolveHandler = (item) => (item ? undefined : rebuild());
  controller.refreshHandler = rebuild;
  controller.createRunProfile(vscode.l10n.t("Run"), vscode.TestRunProfileKind.Run, runTests, true);

  function watch(context) {
    let timer;
    const schedule = () => {
      if (!loaded) return;
      clearTimeout(timer);
      timer = setTimeout(rebuild, REFRESH_DELAY_MS);
    };
    watchCollection(context, YAML_GLOB, schedule);
    context.subscriptions.push({ dispose: () => clearTimeout(timer) });
  }

  return { controller, watch };
}

function activateTesting(context) {
  const { controller, watch } = createTesting();
  context.subscriptions.push(controller);
  watch(context);
}

module.exports = { activateTesting };
