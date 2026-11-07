const METHOD_TONES = {
  GET: "success",
  HEAD: "success",
  OPTIONS: "success",
  POST: "warning",
  PUT: "warning",
  PATCH: "warning",
  DELETE: "destructive",
  GRAPHQL: "primary",
  GRPC: "info",
  MCP: "info",
  WS: "info",
};

const STATUS_TONES = [
  [500, "destructive"],
  [400, "warning"],
  [300, "info"],
  [200, "success"],
];

function methodTone(method) {
  return METHOD_TONES[method] ?? "muted";
}

function statusTone(outcome) {
  if (outcome.error) return "destructive";
  return STATUS_TONES.find(([floor]) => outcome.statusCode >= floor)?.[1] ?? "muted";
}

module.exports = { methodTone, statusTone };
