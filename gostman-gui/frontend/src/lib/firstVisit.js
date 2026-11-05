export const FIRST_VISIT_ID = "first-visit"

export const DATA_LOCATION_KEY = "gostman-data-location"

export const FIRST_VISIT_VARIANTS = { phone: "contents md:hidden", desktop: "hidden md:contents" }

export function revealApp() {
  const placeholder = document.getElementById(FIRST_VISIT_ID)
  if (!placeholder) return
  placeholder.remove()
  document.getElementById("root").hidden = false
}
