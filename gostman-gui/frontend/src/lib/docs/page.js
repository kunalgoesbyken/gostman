export const CONTENT_POLICY = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"

export const STYLE = `
:root {
  color-scheme: light dark;
  --page: #ffffff;
  --panel: #f5f6f8;
  --ink: #1b1f24;
  --soft: #5a6370;
  --line: #dfe3e8;
  --link: #1f55c4;
  --mark: #fff4c2;
  --get: #17753f;
  --post: #8a5200;
  --put: #1d5bb8;
  --patch: #7440ad;
  --delete: #b8322a;
  --graphql: #a82d75;
  --grpc: #0a6f7a;
  --plain: #5a6370;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --page: #101317;
    --panel: #181c22;
    --ink: #e4e7eb;
    --soft: #98a2ae;
    --line: #2a3039;
    --link: #8fb3ff;
    --mark: #3d3513;
    --get: #5fce8c;
    --post: #e2a94f;
    --put: #7fb0f5;
    --patch: #bb95ea;
    --delete: #f08a82;
    --graphql: #ea8cc0;
    --grpc: #5fc7d1;
    --plain: #98a2ae;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-padding-top: 1rem; }
body { margin: 0; background: var(--page); color: var(--ink); font: 16px/1.6 var(--sans); }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
[hidden] { display: none !important; }
.skip { position: absolute; left: -100rem; }
.skip:focus { left: 1rem; top: 1rem; z-index: 2; background: var(--page); padding: 0.25rem 0.5rem; }
.layout { display: grid; grid-template-columns: 18rem minmax(0, 1fr); }
.contents { position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: 1.5rem 1rem 3rem; border-right: 1px solid var(--line); font-size: 0.875rem; line-height: 1.4; }
.contents-title { margin: 0 0 1rem; font-weight: 650; font-size: 1rem; overflow-wrap: anywhere; }
.filter { display: block; width: 100%; margin: 0 0 1rem; padding: 0.4rem 0.6rem; border: 1px solid var(--line); border-radius: 6px; background: var(--page); color: var(--ink); font: inherit; }
.contents ul { list-style: none; margin: 0; padding: 0; }
.contents ul ul { margin-left: 0.5rem; padding-left: 0.5rem; border-left: 1px solid var(--line); }
.contents li { margin: 0; }
.contents a { display: flex; gap: 0.5rem; align-items: baseline; padding: 0.25rem 0.375rem; border-radius: 4px; color: var(--ink); overflow-wrap: anywhere; }
.contents a:hover { background: var(--panel); text-decoration: none; }
.contents .group { margin-top: 0.5rem; font-weight: 650; }
.contents .verb { flex: 0 0 3.25rem; font: 650 0.6875rem/1.4 var(--mono); letter-spacing: 0.02em; }
main { min-width: 0; max-width: 54rem; padding: 2.5rem 3rem 5rem; }
h1, h2, h3, h4, h5 { margin: 0; line-height: 1.25; overflow-wrap: anywhere; }
h1 { font-size: 2rem; letter-spacing: -0.01em; }
h2 { margin-top: 3.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--line); font-size: 1.5rem; }
h3 { margin-top: 2.75rem; font-size: 1.1875rem; }
h4 { margin-top: 1.5rem; font-size: 0.8125rem; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; color: var(--soft); }
h5 { margin-top: 1.25rem; font-size: 0.9375rem; font-weight: 650; }
p { margin: 0.75rem 0 0; }
.intro, .description { max-width: 42rem; overflow-wrap: anywhere; }
.description { white-space: pre-line; }
.note { color: var(--soft); font-size: 0.875rem; }
.anchor { margin-left: 0.4rem; color: var(--soft); font-weight: 400; opacity: 0; }
h2:hover .anchor, h3:hover .anchor, .anchor:focus-visible { opacity: 1; }
:target > h2, :target > h3 { background: var(--mark); }
code, pre, .value { font-family: var(--mono); font-size: 0.8125rem; }
code { overflow-wrap: anywhere; }
.endpoint { display: flex; gap: 0.625rem; align-items: baseline; margin-top: 0.75rem; padding: 0.625rem 0.75rem; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
.endpoint code { min-width: 0; }
.method { flex: none; padding: 0.0625rem 0.4375rem; border: 1px solid currentColor; border-radius: 4px; font: 650 0.75rem/1.5 var(--mono); letter-spacing: 0.02em; }
.is-get { color: var(--get); }
.is-post { color: var(--post); }
.is-put { color: var(--put); }
.is-patch { color: var(--patch); }
.is-delete { color: var(--delete); }
.is-graphql { color: var(--graphql); }
.is-grpc { color: var(--grpc); }
.is-plain { color: var(--plain); }
.names { display: flex; flex-wrap: wrap; gap: 0.375rem; margin: 0.75rem 0 0; padding: 0; list-style: none; }
.names code, p code, dd code { padding: 0.0625rem 0.3125rem; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); }
table { width: 100%; margin-top: 0.5rem; border-collapse: collapse; font-size: 0.875rem; }
th, td { padding: 0.4375rem 0.75rem 0.4375rem 0; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
th { color: var(--soft); font-size: 0.75rem; font-weight: 650; }
th:first-child, td:first-child { width: 34%; }
dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 0.25rem 1rem; margin: 0.5rem 0 0; font-size: 0.875rem; }
dt { color: var(--soft); }
dd { margin: 0; overflow-wrap: anywhere; }
.code { position: relative; margin-top: 0.5rem; }
pre { margin: 0; padding: 0.75rem 0.875rem; max-height: 32rem; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); line-height: 1.5; tab-size: 2; }
.copy { position: absolute; top: 0.375rem; right: 0.375rem; padding: 0.125rem 0.5rem; border: 1px solid var(--line); border-radius: 4px; background: var(--page); color: var(--soft); font: 0.75rem var(--sans); cursor: pointer; }
.copy:hover { color: var(--ink); }
.status { font-family: var(--mono); }
.is-success { color: var(--get); }
.is-redirect { color: var(--put); }
.is-failure { color: var(--delete); }
details { margin-top: 0.5rem; font-size: 0.875rem; }
summary { color: var(--soft); cursor: pointer; }
footer { margin-top: 4rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--soft); font-size: 0.8125rem; }
@media (max-width: 860px) {
  .layout { display: block; }
  .contents { position: static; height: auto; max-height: 55vh; border-right: 0; border-bottom: 1px solid var(--line); }
  main { padding: 1.5rem 1rem 4rem; }
  h1 { font-size: 1.625rem; }
  h2 { font-size: 1.3125rem; }
  .endpoint { flex-direction: column; align-items: flex-start; gap: 0.375rem; }
  .anchor { opacity: 1; }
}
@media print {
  :root { --page: #ffffff; --panel: #ffffff; --ink: #000000; --soft: #444444; --line: #bbbbbb; --link: #000000; --mark: #ffffff; --get: #000000; --post: #000000; --put: #000000; --patch: #000000; --delete: #000000; --graphql: #000000; --grpc: #000000; --plain: #000000; }
  body { font-size: 11pt; }
  .layout { display: block; }
  .contents, .copy, .anchor, .skip { display: none; }
  main { max-width: none; padding: 0; }
  pre { max-height: none; overflow: visible; white-space: pre-wrap; overflow-wrap: anywhere; }
  h2, h3, h4, h5 { break-after: avoid; }
  tr, .endpoint { break-inside: avoid; }
  details > * { display: block; }
}
`

export const SCRIPT = `
(function () {
  var filter = document.getElementById('filter');
  var entries = Array.prototype.slice.call(document.querySelectorAll('[data-search]'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('[data-group]'));
  function applyFilter() {
    var needle = filter.value.trim().toLowerCase();
    entries.forEach(function (entry) {
      entry.hidden = needle !== '' && entry.getAttribute('data-search').indexOf(needle) === -1;
    });
    groups.forEach(function (group) {
      group.hidden = needle !== '' && !group.querySelector('[data-search]:not([hidden])');
    });
  }
  filter.hidden = false;
  filter.addEventListener('input', applyFilter);
  if (!navigator.clipboard) return;
  Array.prototype.forEach.call(document.querySelectorAll('.code'), function (block) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = 'Copy';
    button.addEventListener('click', function () {
      navigator.clipboard.writeText(block.querySelector('code').textContent).then(function () {
        button.textContent = 'Copied';
        setTimeout(function () { button.textContent = 'Copy'; }, 1500);
      });
    });
    block.appendChild(button);
  });
})();
`
