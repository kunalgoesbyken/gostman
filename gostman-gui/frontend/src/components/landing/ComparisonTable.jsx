import { cn } from "../../lib/utils"
import { BrandIcon } from "../ui/brandIcon"
import { COMPARISON_ROWS, PRODUCTS } from "./comparisonData"
import { StatusGlyph } from "./StatusGlyph"

const BAND = "bg-[linear-gradient(hsl(var(--primary)/0.08),hsl(var(--primary)/0.08))]"
const HEAD_CELL = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground md:border-b md:border-border/60"

function ProductName({ product }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BrandIcon brand={product.id} />
      {product.name}
    </span>
  )
}

function Cell({ product, claim }) {
  return (
    <td className={cn("block px-4 pb-4 pt-0 align-top text-sm leading-relaxed md:table-cell md:border-b md:border-border/30 md:py-5", product.id === "gostman" && BAND)}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground md:hidden"><ProductName product={product} /></span>
      <span className="flex items-start gap-2.5">
        <StatusGlyph state={claim.state} />
        <span className={product.id === "gostman" ? "text-foreground" : "text-foreground/80"}>
          {claim.text}
        </span>
      </span>
    </td>
  )
}

function Row({ row }) {
  return (
    <tr className="block border-b border-border/40 py-4 md:table-row md:border-0 md:py-0">
      <th scope="row" className="block px-4 pb-3 text-left text-sm font-medium md:table-cell md:border-b md:border-border/30 md:py-5 md:align-top">
        {row.feature}
      </th>
      {PRODUCTS.map((product) => (
        <Cell key={product.id} product={product} claim={row[product.id]} />
      ))}
    </tr>
  )
}

export function ComparisonTable() {
  return (
    <table className="block w-full border-separate border-spacing-0 md:table md:table-fixed">
      <caption className="mb-4 block text-left md:table-caption text-sm text-muted-foreground">
        Gostman, Postman, Bruno and Insomnia compared feature by feature.
      </caption>
      <thead className="sr-only md:table-header-group md:not-sr-only">
        <tr>
          <th scope="col" className={cn(HEAD_CELL, "md:w-[22%]")}>
            Feature
          </th>
          {PRODUCTS.map((product) => (
            <th key={product.id} scope="col" className={cn(HEAD_CELL, product.id === "gostman" && BAND)}>
              <ProductName product={product} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {COMPARISON_ROWS.map((row) => (
          <Row key={row.feature} row={row} />
        ))}
      </tbody>
    </table>
  )
}
