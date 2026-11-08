export const OWNER = "kunalgoesbyken"
export const REPOSITORY = `${OWNER}/gostman`
export const REPOSITORY_URL = `https://github.com/${REPOSITORY}`
export const SPONSOR_URL = `https://github.com/sponsors/${OWNER}`
export const ISSUES_URL = `${REPOSITORY_URL}/issues`
export const TRANSLATIONS_ISSUE_URL = `${ISSUES_URL}/15`
export const TRANSLATE_URL = "https://hosted.weblate.org/engage/gostman/"
export const RELEASES_URL = `${REPOSITORY_URL}/releases/latest`
export const DOCS_URL = `${REPOSITORY_URL}/blob/main/docs`
export const HOMEBREW_TAP = `${OWNER}/tap`
export const SCOOP_BUCKET_URL = `https://github.com/${OWNER}/scoop-gostman`
export const GO_MODULE = `github.com/${REPOSITORY}`
export const SEEDFALL_URL = `https://github.com/${OWNER}/seedfall`
export const ALTERNATIVETO_URL = "https://alternativeto.net/software/gostman/about/?utm_source=badge&utm_medium=referral"
export const ALTERNATIVETO_BADGE_URL = "https://alternativeto.net/static/badges/badge-wide-dark.svg"

const DEFAULT_SITE_URL = "https://gostman.com"

export function docsUrl(path = "") {
  const site = typeof __SITE_URL__ === "string" ? __SITE_URL__ : DEFAULT_SITE_URL
  return path ? `${site}/docs/${path}` : `${site}/docs`
}
