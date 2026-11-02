import { fetchContract } from './contractCheck'
import { contractCoverage, mergeCoverage } from './coverage'

const reachedOperation = (result) => Boolean(result.operation) && Boolean(result.spec) && !result.skipped && result.statusCode > 0 && !result.error

export async function coverageOfRun(backend, results) {
  const hitsBySpec = new Map()
  for (const result of results.filter(reachedOperation)) {
    if (!hitsBySpec.has(result.spec)) hitsBySpec.set(result.spec, [])
    hitsBySpec.get(result.spec).push({ key: result.operation, status: result.statusCode })
  }
  const coverages = await Promise.all([...hitsBySpec].map(async ([spec, hits]) => {
    try {
      return contractCoverage(await fetchContract(backend, spec), hits)
    } catch {
      return null
    }
  }))
  const available = coverages.filter(Boolean)
  return available.length === 0 ? null : mergeCoverage(available)
}
