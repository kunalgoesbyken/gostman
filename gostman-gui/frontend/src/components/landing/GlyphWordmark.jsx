import { cn } from "../../lib/utils"
import { cellHash, glyphAt, joinRuns, toneAt } from "./glyphs"

const LETTERS = {
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
}

const WORD = "GOSTMAN"
const PIXEL_COLUMNS = 3
const PIXEL_ROWS = 2
const MARGIN_ROWS = 5
const COLUMNS = 200
const NOISE_DENSITY = 30
const NOISE_TONE = "text-muted-foreground/10"

const letterRows = LETTERS.G.map((_, row) => WORD.split("").map((letter) => LETTERS[letter][row]).join("."))
const WORD_WIDTH = letterRows[0].length * PIXEL_COLUMNS
const WORD_LEFT = Math.floor((COLUMNS - WORD_WIDTH) / 2)
const ROWS = letterRows.length * PIXEL_ROWS + MARGIN_ROWS * 2

function litPixel(row, column) {
  const pixelRow = Math.floor((row - MARGIN_ROWS) / PIXEL_ROWS)
  const pixelColumn = Math.floor((column - WORD_LEFT) / PIXEL_COLUMNS)
  const line = letterRows[pixelRow]
  if (line?.[pixelColumn] !== "#") return null
  return { pixelRow, pixelColumn }
}

function cellAt(row, column) {
  const pixel = litPixel(row, column)
  if (pixel) return { tone: toneAt(pixel.pixelRow, pixel.pixelColumn), text: glyphAt(row, column) }
  const isNoise = cellHash(column, row + ROWS) % 100 < NOISE_DENSITY
  return { tone: NOISE_TONE, text: isNoise ? glyphAt(row, column) : " " }
}

const LINES = Array.from({ length: ROWS }, (_, row) => joinRuns(Array.from({ length: COLUMNS }, (_, column) => cellAt(row, column))))

export function GlyphWordmark({ className }) {
  return (
    <div aria-hidden="true" className={cn("glyph-wordmark flex justify-center overflow-hidden border-t border-border/40 py-8", className)}>
      <pre className="reveal-on-scroll m-0 shrink-0 font-mono font-bold leading-none" style={{ "--glyph-columns": WORD_WIDTH }}>
        {LINES.map((runs, row) => (
          <div key={row}>
            {runs.map((run, index) => (
              <span key={index} className={run.tone}>
                {run.text}
              </span>
            ))}
          </div>
        ))}
      </pre>
    </div>
  )
}
