const { collections } = require("./collections");
const { readCollection } = require("./workspaceFiles");

function owned(nodes, collection) {
  return nodes.map((node) => (node.kind === "request" ? { ...node, collection } : { ...node, collection, children: owned(node.children, collection) }));
}

async function collectionNode(collection) {
  return { kind: "collection", path: collection.root, name: collection.label, collection, children: owned(await readCollection(collection.root), collection) };
}

async function readTree() {
  const found = await collections.all();
  if (found.length === 1) return owned(await readCollection(found[0].root), found[0]);
  return Promise.all(found.map(collectionNode));
}

module.exports = { readTree };
