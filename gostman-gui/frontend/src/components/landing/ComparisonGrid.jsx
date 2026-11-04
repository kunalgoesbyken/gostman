import { cn } from "../../lib/utils"
import { COMPARISON_ROWS, PRODUCTS } from "./comparisonData"
import { ProductMark } from "./ProductMark"
import { StatusGlyph } from "./StatusGlyph"

const BAND = "bg-primary/[0.08]"
const LINE = "border-b border-border/40"

const banded = (product) => product.id === "gostman" && BAND

function ProductHead({ product }) {
  return (
    <th scope="col" className={cn("px-1 py-3 align-bottom", LINE, banded(product))}>
      <span className="flex flex-col items-center gap-1.5 text-xs font-medium text-muted-foreground md:flex-row md:justify-center md:gap-2">
        <ProductMark product={product} className="h-4 w-4" />
        <span className="max-sm:sr-only">{product.name}</span>
      </span>
    </th>
  )
}

const LABEL_TONES = {
  included: "text-success",
  partial: "text-muted-foreground",
  excluded: "text-muted-foreground/70",
}

function ClaimLabel({ claim }) {
  return <span aria-hidden="true" className={cn("text-center text-xs font-medium leading-tight", LABEL_TONES[claim.state])}>{claim.label}</span>
}

function Claim({ product, claim }) {
  return (
    <td title={claim.text} className={cn("px-1 py-3.5", LINE, banded(product))}>
      <span className="flex justify-center">
        {claim.label ? <ClaimLabel claim={claim} /> : <StatusGlyph state={claim.state} />}
      </span>
      <span className="sr-only">{claim.text}</span>
    </td>
  )
}

export function ComparisonGrid() {
  return (
    <table className="w-full table-fixed border-separate border-spacing-0">
      <caption className="sr-only">Gostman, Postman, Bruno and Insomnia compared feature by feature.</caption>
      <thead>
        <tr>
          <th scope="col" className={cn("w-[40%] md:w-[36%]", LINE)}>
            <span className="sr-only">Feature</span>
          </th>
          {PRODUCTS.map((product) => (
            <ProductHead key={product.id} product={product} />
          ))}
        </tr>
      </thead>
      <tbody>
        {COMPARISON_ROWS.map((row) => (
          <tr key={row.feature}>
            <th scope="row" className={cn("py-3.5 pe-3 text-left text-sm font-medium text-foreground", LINE)}>
              {row.feature}
            </th>
            {PRODUCTS.map((product) => (
              <Claim key={product.id} product={product} claim={row[product.id]} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
