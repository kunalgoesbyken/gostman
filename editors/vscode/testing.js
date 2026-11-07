const vscode = require("vscode");
const { capture } = require("./cli");
const { environmentArgs } = require("./settings");
const { collections } = require("./collections");
const { readCollection, REFERENCE_SEPARATOR } = require("./workspaceFiles");
const { parseReport, verdict, resultLine } = require("./report");

const REFRESH_DELAY_MS = 300;

function itemsOf(collection) {
  const found = [];
  collection.forEach((item) => found.push(item));
  return found;
}

async function collectionNode(collection) {
  return { kind: "collection", path: collection.root, name: collection.label, collection, children: await readCollection(collection.root) };
}

function sortKey(index) {
  return String(index).padStart(6, "0");
}

function createTesting() {
  const controller = vscode.tests.createTestController("gostman", "Gostman");
  const nodes = new WeakMap();
  let loaded = false;
  let queue = Promise.resolve();

  function sync(target, list, collection) {
    const items = list.map((node, index) => {
      const owner = node.collection ?? collection;
      const item = target.get(node.path) ?? controller.createTestItem(node.path, node.name, vscode.Uri.file(node.path));
      item.label = node.name;
      item.sortText = sortKey(index);
      nodes.set(item, { ...node, collection: owner });
      if (node.kind !== "request") sync(item.children, node.children, owner);
      return item;
    });
    target.replace(items);
  }

  async function refreshItems() {
    loaded = true;
    const found = await collections.all();
    if (found.length === 1) sync(controller.items, await readCollection(found[0].root), found[0]);
    else sync(controller.items, await Promise.all(found.map(collectionNode)));
  }

  function rebuild() {
    queue = queue.then(refreshItems).catch(() => undefined);
    return queue;
  }

  function leaves(item, excluded) {
    if (excluded.has(item)) return [];
    if (nodes.get(item).kind === "request") return [item];
    return itemsOf(item.children).flatMap((child) => leaves(child, excluded));
  }

  function byCollection(items) {
    const groups = new Map();
    for (const item of items) {
      const { collection } = nodes.get(item);
      groups.set(collection, [...(groups.get(collection) ?? []), item]);
    }
    return groups;
  }

  function isWhole(request, chosen, excluded) {
    return excluded.size === 0 && (!request.include || chosen.some((item) => nodes.get(item).kind === "collection"));
  }

  function selectionFor(chosen, items, excluded) {
    const single = excluded.size === 0 && chosen.length === 1 ? nodes.get(chosen[0]) : undefined;
    if (single?.kind === "folder") return ["--folder", single.reference];
    return items.flatMap((item) => ["--only", nodes.get(item).reference]);
  }

  function plan(request) {
    const excluded = new Set(request.exclude ?? []);
    const included = request.include ?? itemsOf(controller.items);
    const items = [...new Set(included.flatMap((item) => leaves(item, excluded)))];
    const chosenBy = byCollection(included);
    return [...byCollection(items)].map(([collection, leafItems]) => {
      const chosen = chosenBy.get(collection) ?? [];
      const selection = isWhole(request, chosen, excluded) ? [] : selectionFor(chosen, leafItems, excluded);
      return { collection, selection, items: leafItems };
    });
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

  async function execute(run, { collection, selection, items }, signal, heading) {
    if (items.length === 0 || signal.aborted) return;
    items.forEach((item) => run.started(item));
    if (heading) run.appendOutput(`${heading}\r\n`);
    try {
      const args = ["run", ".", ...selection, ...environmentArgs(collection.root), "--redact", "--reporter", "json"];
      const { stdout, stderr } = await capture(args, { cwd: collection.root, signal });
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
      const parts = plan(request);
      for (const part of parts) {
        const heading = parts.length > 1 ? vscode.l10n.t("Collection {0}", part.collection.label) : undefined;
        await execute(run, part, abort.signal, heading);
      }
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
    context.subscriptions.push(collections.onDidChange(schedule), collections.onDidTouch(schedule), { dispose: () => clearTimeout(timer) });
  }

  return { controller, watch };
}

function activateTesting(context) {
  const { controller, watch } = createTesting();
  context.subscriptions.push(controller);
  watch(context);
}

module.exports = { activateTesting };
