import { cn } from "../lib/utils"

function NavList({ nav, currentHref }) {
  return (
    <nav aria-label="Documentation" className="space-y-7">
      {nav.map((section) => (
        <div key={section.title}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.title}</p>
          <ul className="mt-3 space-y-1">
            {section.items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  aria-current={item.href === currentHref ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    item.href === currentHref && "bg-muted/40 text-foreground",
                  )}
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function DocsNav({ nav, currentHref }) {
  return (
    <>
      <details className="rounded-lg border border-border/60 bg-card/40 px-4 py-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-medium">Documentation menu</summary>
        <div className="mt-5">
          <NavList nav={nav} currentHref={currentHref} />
        </div>
      </details>
      <div className="hidden lg:sticky lg:top-28 lg:block lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
        <NavList nav={nav} currentHref={currentHref} />
      </div>
    </>
  )
}
