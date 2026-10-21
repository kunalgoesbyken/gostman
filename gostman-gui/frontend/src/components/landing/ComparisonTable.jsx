import { cn } from "../../lib/utils"
import { COMPARISON_DATE, COMPARISON_ROWS, COMPARISON_SOURCES, PRODUCTS } from "./comparisonData"
import { StatusGlyph } from "./StatusGlyph"

const SOURCE_NUMBER = Object.fromEntries(COMPARISON_SOURCES.map((source, index) => [source.id, index + 1]))
const BAND = "bg-[linear-gradient(hsl(var(--primary)/0.08),hsl(var(--primary)/0.08))]"
const HEAD_CELL = "bg-background px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground md:sticky md:top-20 md:z-10 md:border-b md:border-border/60"

function Citations({ ids = [] }) {
  return ids.map((id) => (
    <a
      key={id}
      href={`#comparison-source-${id}`}
      aria-label={`Source ${SOURCE_NUMBER[id]}`}
      className="relative -top-1 ml-1 inline-block text-[0.7rem] leading-none text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      [{SOURCE_NUMBER[id]}]
    </a>
  ))
}

function Cell({ product, claim }) {
  return (
    <td className={cn("block px-4 pb-4 pt-0 align-top text-sm leading-relaxed md:table-cell md:border-b md:border-border/30 md:py-5", product.id === "gostman" && BAND)}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground md:hidden">{product.name}</span>
      <span className="flex items-start gap-2.5">
        <StatusGlyph state={claim.state} />
        <span className={product.id === "gostman" ? "text-foreground" : "text-foreground/80"}>
          {claim.text}
          <Citations ids={claim.cite} />
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
        Gostman, Postman and Bruno compared feature by feature. Claims about Postman and Bruno link to their public pages, checked {COMPARISON_DATE}.
      </caption>
      <thead className="sr-only md:table-header-group md:not-sr-only">
        <tr>
          <th scope="col" className={cn(HEAD_CELL, "md:w-[22%]")}>
            Feature
          </th>
          {PRODUCTS.map((product) => (
            <th key={product.id} scope="col" className={cn(HEAD_CELL, product.id === "gostman" && BAND)}>
              {product.name}
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
