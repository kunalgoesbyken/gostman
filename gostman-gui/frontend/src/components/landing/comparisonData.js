import { FEATURES } from "../../lib/featureCatalog"
import siteFeatures from "./siteFeatures.json"

export const PRODUCTS = [
  { id: "gostman", name: "Gostman" },
  { id: "postman", name: "Postman" },
  { id: "bruno", name: "Bruno" },
  { id: "insomnia", name: "Insomnia" },
]

export const STATES = {
  included: "Included",
  partial: "Partial",
  excluded: "Not included",
}

export const COMPARISON_ROWS = FEATURES
  .filter((feature) => feature.compare)
  .sort((first, second) => first.compare - second.compare)
  .map((feature) => siteFeatures.compare[feature.id])

export const GLYPH_STATES = Object.keys(STATES).filter((state) =>
  COMPARISON_ROWS.some((row) => PRODUCTS.some((product) => !row[product.id].label && row[product.id].state === state)),
)
