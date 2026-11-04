import { compareVersions } from './versions.js'

export const RELEASES = [
  { version: '1.15.0', ids: ['flow-parallel', 'flow-condition-groups', 'flow-variables'] },
  { version: '1.14.0', ids: ['ci-pr-comment'] },
  { version: '1.13.0', ids: ['flow-canvas', 'flow-switch', 'flow-repeat', 'nested-flows', 'flow-inputs', 'flow-metrics'] },
  { version: '1.12.0', ids: ['json-tree-depth', 'typed-variables', 'variables-view', 'inherited-variables'] },
  { version: '1.11.0', ids: ['api-design'] },
  { version: '1.10.0', ids: ['vscode-extension', 'ai-inline', 'nats', 'firecamp-import', 'openapi-fuzz', 'mock-data-rows'] },
  {
    version: '1.9.0',
    ids: [
      'hex-view', 'msgpack-cbor', 'certificate-viewer', 'jwt-signing', 'http-version', 'dns-override',
      'graphql-upload', 'ws-security', 'grpc-web', 'signalr', 'tcp-udp', 'breakpoints', 'spec-importers', 'versioned-docs', 'notes', 'recently-deleted', 'snapshot-checks', 'negative-tests',
      'coverage', 'pm-packages', 'load-thresholds', 'monitors', 'capture-rules', 'capture-har',
      'git-field-diff', 'git-commit-graph', 'repo-create', 'ai-mock', 'ai-commit', 'xlsx-data',
      'scheduled-runs', 'openapi-diff', 'ci-starters', 'json-rpc', 'response-compare', 'response-har', 'split-view', 'global-search', 'dependency-graph',
    ],
  },
  { version: '1.8.3', ids: ['open-tabs'] },
]

export const latestRelease = () => RELEASES.reduce((latest, release) => (compareVersions(release.version, latest.version) > 0 ? release : latest))

export const releasesBetween = (seen, current) => RELEASES
  .filter((release) => compareVersions(release.version, seen) > 0 && compareVersions(release.version, current) <= 0)
  .sort((first, second) => compareVersions(second.version, first.version))
