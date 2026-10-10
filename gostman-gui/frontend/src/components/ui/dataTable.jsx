import { cn } from "../../lib/utils"

const CELL = "truncate px-3 py-1.5 text-left"

const textOf = (column, row) => (column.text ? column.text(row) : row[column.key])

export function DataTable({ columns, rows }) {
  return (
    <table className="w-full table-fixed border-collapse text-xs">
      <thead className="sticky top-0 bg-background">
        <tr className="border-b border-border">
          {columns.map((column) => (
            <th
              key={column.header}
              title={column.header}
              className={cn(CELL, "text-[11px] font-medium uppercase tracking-wide text-muted-foreground", column.width)}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-b border-border hover:bg-accent">
            {columns.map((column) => (
              <td key={column.header} title={textOf(column, row)} className={cn(CELL, "font-mono text-muted-foreground", column.cellClassName)}>
                {textOf(column, row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
