import { buildReportPage, reportOf } from './runReport'

const MS_PER_SECOND = 1000
const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

const escapeXml = (text) => String(text).replace(/[&<>"]/g, (character) => XML_ESCAPES[character])

const seconds = (milliseconds) => (milliseconds / MS_PER_SECOND).toFixed(3)

const failureOf = (result) => {
  const failedTests = result.tests.filter((test) => !test.passed).map((test) => test.name)
  return [result.error, ...failedTests].filter(Boolean).join('; ')
}

function testCase(result) {
  const attributes = `classname="${escapeXml(result.folder || 'requests')}" name="${escapeXml(result.name)}" time="${seconds(result.durationMs)}"`
  if (result.skipped) return `    <testcase ${attributes}><skipped message="${escapeXml(result.skipped)}"/></testcase>`
  if (result.failed && !result.handled) return `    <testcase ${attributes}><failure message="${escapeXml(failureOf(result))}"/></testcase>`
  return `    <testcase ${attributes}/>`
}

function junitOf(report) {
  const { summary } = report
  const suite = `<testsuite name="${escapeXml(report.collection ?? 'Gostman')}" tests="${report.results.length}" failures="${summary.failed}" skipped="${summary.skipped}" time="${seconds(report.durationMs)}">`
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<testsuites>', `  ${suite}`, ...report.results.map(testCase), '  </testsuite>', '</testsuites>', ''].join('\n')
}

export const REPORT_FORMATS = {
  html: { file: 'gostman-report.html', type: 'text/html', build: buildReportPage },
  junit: { file: 'gostman-report.xml', type: 'application/xml', build: (...args) => junitOf(reportOf(...args)) },
  json: { file: 'gostman-report.json', type: 'application/json', build: (...args) => JSON.stringify(reportOf(...args), null, 2) },
}

export const REPORT_FORMAT_IDS = Object.keys(REPORT_FORMATS)
