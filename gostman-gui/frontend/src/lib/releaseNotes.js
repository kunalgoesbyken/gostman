import { compareVersions } from './versions.js'

export const RELEASES = [
  {
    version: '1.9.0',
    ids: [
      'hex-view', 'msgpack-cbor', 'certificate-viewer', 'jwt-signing', 'http-version', 'dns-override', 'graphql-upload', 'ws-security',
      'grpc-web', 'signalr', 'tcp-udp', 'breakpoints', 'throttling', 'spec-importers', 'versioned-docs', 'notes', 'recently-deleted',
      'global-search', 'split-view', 'dependency-graph', 'snapshot-checks', 'negative-tests', 'coverage', 'pm-packages', 'openapi-diff',
      'load-thresholds', 'monitors', 'pre-commit', 'capture-rules', 'capture-har', 'git-field-diff', 'git-commit-graph', 'repo-create',
      'ai-mock', 'ai-commit',
    ],
  },
  { version: '1.8.3', ids: ['open-tabs'] },
]

export const latestRelease = () => RELEASES.reduce((latest, release) => (compareVersions(release.version, latest.version) > 0 ? release : latest))

export const releasesBetween = (seen, current) => RELEASES
  .filter((release) => compareVersions(release.version, seen) > 0 && compareVersions(release.version, current) <= 0)
  .sort((first, second) => compareVersions(second.version, first.version))
