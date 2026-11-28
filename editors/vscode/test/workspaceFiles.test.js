const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { isRequestText, readCollection, requestReference } = require("../workspaceFiles");

const plain = "name: Plain keys\nmethod: GET\nurl: https://example.com\n";
const doubleQuoted = '"name": Double-quoted keys\n"id": double\n"method": POST\n"url": https://example.com\n';
const singleQuoted = "'name': Single-quoted keys\n'id': single\n'method' : PATCH\n'url': https://example.com\n";

async function temporaryCollection(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gostman-workspace-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("collection discovery reads request markers and metadata with quoted keys", async (t) => {
  const root = await temporaryCollection(t);
  await fs.writeFile(path.join(root, "plain.yaml"), plain);
  await fs.writeFile(path.join(root, "double.yaml"), doubleQuoted);
  await fs.writeFile(path.join(root, "single.yaml"), singleQuoted);

  const requests = await readCollection(root);
  const metadata = requests.map(({ name, reference, method }) => ({ name, reference, method }));
  assert.deepEqual(metadata, [
    { name: "Double-quoted keys", reference: "double", method: "POST" },
    { name: "Plain keys", reference: "Plain keys", method: "GET" },
    { name: "Single-quoted keys", reference: "single", method: "PATCH" },
  ]);
  assert.equal(await requestReference(root, path.join(root, "double.yaml")), "double");
});

test("sending resolves a mixed-quote request by its quoted folder and request names", async (t) => {
  const root = await temporaryCollection(t);
  const folder = path.join(root, "on-disk-folder");
  const file = path.join(folder, "on-disk-request.yaml");
  await fs.mkdir(folder);
  await fs.writeFile(path.join(folder, "folder.yaml"), "'name': Saved folder\n");
  await fs.writeFile(file, '"name": Mixed quotes\n"method": GET\n\'url\': https://example.com\n');

  assert.equal(await requestReference(root, file), "Saved folder/Mixed quotes");
});

test("recognises quoted top-level request markers in the editor", () => {
  assert.equal(isRequestText(plain), true);
  assert.equal(isRequestText('"method": POST\n'), true);
  assert.equal(isRequestText("'url': https://example.com\n"), true);
  assert.equal(isRequestText('options:\n  "method": POST\n'), false);
  assert.equal(isRequestText('"method: POST": description\n'), false);
  assert.equal(isRequestText("'method: POST': description\n"), false);
  assert.equal(isRequestText('"method: POST\n'), false);
  assert.equal(isRequestText("'method'' : POST\n"), false);
  assert.equal(isRequestText('"meth\\"od": POST\n'), false);
  assert.equal(isRequestText("'meth''od': POST\n"), false);
  assert.equal(isRequestText('"method" extra: POST\n'), false);
});

test("quoted keys allow YAML separation characters before the colon", () => {
  assert.equal(isRequestText('"method" \t: POST\n'), true);
  for (const invalidSeparator of ["\u00a0", "\v", "\f"]) {
    assert.equal(isRequestText(`"method"${invalidSeparator}: POST\n`), false, JSON.stringify(invalidSeparator));
  }
});
