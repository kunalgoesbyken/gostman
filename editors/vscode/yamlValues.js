const NOT_A_KEY_START = new Set([" ", "\t", "-", "#"]);
const BLOCK_INDICATORS = new Set(["|", ">"]);
const BYTE_ORDER_MARK = 0xfeff;

function isYamlFile(name) {
  const lower = name.toLowerCase();
  return lower.endsWith(".yaml") || lower.endsWith(".yml");
}

function closingQuote(text, quote) {
  for (let index = 1; index < text.length; index++) {
    if (quote === '"' && text[index] === "\\") {
      index++;
      continue;
    }
    if (text[index] !== quote) continue;
    if (quote === "'" && text[index + 1] === "'") {
      index++;
      continue;
    }
    return index;
  }
  return text.length;
}

function unquoted(text, end = closingQuote(text, text[0])) {
  const quote = text[0];
  const inner = text.slice(1, end);
  if (quote === "'") return inner.replaceAll("''", "'");
  try {
    return JSON.parse(`"${inner}"`);
  } catch {
    return inner;
  }
}

function scalar(text) {
  if (text === "" || BLOCK_INDICATORS.has(text[0])) return "";
  if (text[0] === '"' || text[0] === "'") return unquoted(text);
  const comment = text.indexOf(" #");
  return (comment < 0 ? text : text.slice(0, comment)).trim();
}

function readValues(text, keys) {
  const found = new Map();
  const body = text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;
  for (const raw of body.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line === "" || NOT_A_KEY_START.has(line[0])) continue;
    const quote = line[0];
    const endQuote = quote === '"' || quote === "'" ? closingQuote(line, quote) : -1;
    const colon = line.indexOf(":", endQuote + 1);
    if (colon < 1 || (endQuote >= 0 && /[^ \t]/.test(line.slice(endQuote + 1, colon)))) continue;
    const key = endQuote >= 0 ? unquoted(line, endQuote) : line.slice(0, colon);
    const rest = line.slice(colon + 1);
    const endsKey = rest === "" || rest[0] === " " || rest[0] === "\t";
    if (!endsKey || !keys.includes(key) || found.has(key)) continue;
    found.set(key, scalar(rest.trim()));
  }
  return found;
}

module.exports = { isYamlFile, readValues };
