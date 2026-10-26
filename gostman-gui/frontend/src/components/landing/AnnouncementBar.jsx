import { cn } from "../../lib/utils"
import { RELEASES_URL } from "../../lib/siteLinks"
import { GLYPH_TONES, cellHash, glyphAt } from "./glyphs"

const STRIP_LENGTH = 64
const TWINKLE_STEPS = 12
const LIT_EVERY = 7

const stripGlyphs = (side) =>
  Array.from({ length: STRIP_LENGTH }, (_, index) => {
    const hash = cellHash(side, index)
    return {
      glyph: glyphAt(side, index),
      tone: hash % LIT_EVERY === 0 ? GLYPH_TONES[hash % GLYPH_TONES.length] : "text-muted-foreground/40",
      step: hash % TWINKLE_STEPS,
    }
  })

const LEFT_STRIP = stripGlyphs(0)
const RIGHT_STRIP = stripGlyphs(1)

function GlyphStrip({ glyphs, className }) {
  return (
    <span aria-hidden="true" className={cn("hidden min-w-0 flex-1 overflow-hidden whitespace-nowrap font-mono text-[11px] tracking-[0.3em] sm:flex", className)}>
      {glyphs.map((cell, index) => (
        <span key={index} className={cn("glyph-twinkle", cell.tone)} style={{ "--glyph-step": cell.step }}>
          {cell.glyph}
        </span>
      ))}
    </span>
  )
}

export function AnnouncementBar() {
  return (
    <div className="border-b border-border/40 px-6">
      <div className="mx-auto flex h-8 max-w-6xl items-center gap-6 text-xs">
        <GlyphStrip glyphs={LEFT_STRIP} className="justify-end [mask-image:linear-gradient(to_left,black,transparent)]" />
        <p className="mx-auto shrink-0 text-muted-foreground">
          Gostman {__APP_VERSION__} is out.{" "}
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:text-primary">
            See what changed
          </a>
        </p>
        <GlyphStrip glyphs={RIGHT_STRIP} className="[mask-image:linear-gradient(to_right,black,transparent)]" />
      </div>
    </div>
  )
}
