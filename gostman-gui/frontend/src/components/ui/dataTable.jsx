import React from 'react'

/** Reusable table component for headers/cookies display */
export function DataTable({ columns, rows, emptyIcon: EmptyIcon, emptyTitle, emptySubtitle }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 rounded-full bg-muted/30 p-4">
          <EmptyIcon className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <p className="text-sm text-muted-foreground">{emptyTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground/50">{emptySubtitle}</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto pb-4 scrollbar-primary">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/50 z-10">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className={`text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] ${col.width || ''} ${col.nowrap ? 'whitespace-nowrap' : ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-border/20 hover:bg-primary/5 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/5'}`}
            >
              {columns.map((col, j) => (
                <td
                  key={j}
                  className={`px-4 py-2.5 font-mono text-muted-foreground ${col.cellClassName || ''}`}
                >
                  {col.render ? col.render(row, i) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
