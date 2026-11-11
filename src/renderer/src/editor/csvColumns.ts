import { StateField, type Extension, type Range } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'
import { fileNameOf, splitName } from '../utils/path'
import { refreshDecorations } from './markdownStyle'

export const COLUMN_COLORS = 8

// 두 글자 후보가 한 글자 후보보다 앞에 있어야 한 줄을 나눌 때 먼저 잡힌다
export const DELIMITER_CANDIDATES = [', ', '||', ',', ';', '\t', '|', '^', '~', ':']

const EXT_HINT: Record<string, string> = {
  csv: ',',
  tsv: '\t',
  tab: '\t',
  psv: '|',
  dsv: ','
}

const SNIFF_LINES = 20

export function delimitedHint(filePath: string): string | null {
  return EXT_HINT[splitName(fileNameOf(filePath)).ext.slice(1).toLowerCase()] ?? null
}

export interface FieldRange {
  from: number
  to: number
}

/** 한 줄을 칸과 구분자 위치로 나눈다. 따옴표로 감싼 칸 안의 구분자는 무시한다. */
export function splitLine(
  text: string,
  delimiter: string
): { cells: FieldRange[]; delimiters: FieldRange[] } {
  const cells: FieldRange[] = []
  const delimiters: FieldRange[] = []
  let start = 0
  let i = 0
  let inQuote = false
  let cellStart = true
  while (i < text.length) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') i += 2
        else {
          inQuote = false
          i += 1
        }
      } else i += 1
      continue
    }
    if (cellStart && ch === '"') {
      inQuote = true
      cellStart = false
      i += 1
      continue
    }
    if (text.startsWith(delimiter, i)) {
      cells.push({ from: start, to: i })
      delimiters.push({ from: i, to: i + delimiter.length })
      i += delimiter.length
      start = i
      cellStart = true
      continue
    }
    cellStart = false
    i += 1
  }
  cells.push({ from: start, to: text.length })
  return { cells, delimiters }
}

function sampleLines(text: string): string[] {
  const out: string[] = []
  let pos = 0
  while (out.length < SNIFF_LINES && pos < text.length) {
    let end = text.indexOf('\n', pos)
    if (end === -1) end = text.length
    const line = text.slice(pos, end).replace(/\r$/, '')
    if (line.trim()) out.push(line)
    pos = end + 1
  }
  return out
}

/** 앞쪽 줄들을 보고 모든 줄에서 같은 횟수로 나오는 구분자를 고른다. 없으면 null. */
export function detectDelimiter(text: string, hint: string | null): string | null {
  const lines = sampleLines(text)
  if (lines.length === 0) return hint
  const counts = new Map<string, number[]>()
  for (const d of DELIMITER_CANDIDATES) {
    counts.set(
      d,
      lines.map((l) => splitLine(l, d).delimiters.length)
    )
  }
  const consistent = DELIMITER_CANDIDATES.filter((d) => {
    const c = counts.get(d) as number[]
    return c[0] > 0 && c.every((n) => n === c[0])
  })
  // 두 글자 구분자가 한 글자 구분자를 전부 품고 있으면(예: 모든 쉼표 뒤에 공백) 두 글자 쪽만 남긴다
  const dominated = new Set<string>()
  for (const long of consistent.filter((d) => d.length > 1)) {
    for (const short of consistent.filter((d) => d.length === 1 && long.includes(d))) {
      const allInside = lines.every((l) => {
        const { cells } = splitLine(l, long)
        return cells.every((c) => splitLine(l.slice(c.from, c.to), short).delimiters.length === 0)
      })
      if (allInside) dominated.add(short)
    }
  }
  const pool = consistent.filter((d) => !dominated.has(d))
  if (pool.length > 0) {
    const score = (d: string): number => (counts.get(d) as number[])[0]
    return [...pool].sort((a, b) => {
      if (score(b) !== score(a)) return score(b) - score(a)
      if (a === hint) return -1
      if (b === hint) return 1
      return 0
    })[0]
  }
  // 줄마다 조금씩 다르면 횟수가 가장 고른 후보
  let best: string | null = null
  let bestSpread = Infinity
  for (const d of DELIMITER_CANDIDATES) {
    const c = counts.get(d) as number[]
    if (Math.min(...c) === 0) continue
    const spread = Math.max(...c) - Math.min(...c)
    if (spread < bestSpread) {
      best = d
      bestSpread = spread
    }
  }
  return best
}

export interface CsvConfig {
  delimiter: string | null
  header: boolean
}

const csvConfigField = StateField.define<CsvConfig>({
  create: () => ({ delimiter: null, header: true }),
  update: (value) => value
})

const cellMarks = Array.from({ length: COLUMN_COLORS }, (_, i) =>
  Decoration.mark({ class: `cm-csv-c${i}` })
)
const headMarks = Array.from({ length: COLUMN_COLORS }, (_, i) =>
  Decoration.mark({ class: `cm-csv-c${i} cm-csv-head` })
)
const delimiterMark = Decoration.mark({ class: 'cm-csv-delim' })

/** 열 너비를 구할 때 훑는 줄 수. 큰 파일에서 입력이 느려지지 않게 앞쪽만 본다 */
const ALIGN_SCAN_LINES = 5000

/** 글자 폭(칸 수): 한글·한자 같은 넓은 글자는 2칸, 나머지는 1칸 */
function cellWidth(text: string): number {
  let w = 0
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0
    w +=
      (c >= 0x1100 && c <= 0x115f) ||
      (c >= 0x2e80 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe6f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6)
        ? 2
        : 1
  }
  return w
}

/** 열마다 가장 긴 칸의 폭(칸 수) */
function columnWidths(view: EditorView, delimiter: string): number[] {
  const doc = view.state.doc
  const widths: number[] = []
  const last = Math.min(doc.lines, ALIGN_SCAN_LINES)
  for (let n = 1; n <= last; n++) {
    const text = doc.line(n).text
    const { cells, delimiters } = splitLine(text, delimiter)
    if (delimiters.length === 0) continue
    // 마지막 칸은 뒤에 구분자가 없어 맞출 필요가 없다
    for (let i = 0; i < cells.length - 1; i++) {
      widths[i] = Math.max(widths[i] ?? 0, cellWidth(text.slice(cells[i].from, cells[i].to)))
    }
  }
  return widths
}

/** 문서에는 들어가지 않는 빈 간격. 칸 뒤에 놓아 열을 화면에서만 맞춘다 */
class PadWidget extends WidgetType {
  constructor(readonly px: number) {
    super()
  }
  eq(other: PadWidget): boolean {
    return other.px === this.px
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.style.display = 'inline-block'
    span.style.width = `${this.px}px`
    span.setAttribute('aria-hidden', 'true')
    return span
  }
  ignoreEvent(): boolean {
    return true
  }
}

function buildDecorations(view: EditorView, widths: number[]): DecorationSet {
  const { delimiter, header } = view.state.field(csvConfigField)
  if (!delimiter) return Decoration.none
  const ranges: Range<Decoration>[] = []
  const doc = view.state.doc
  const charW = view.defaultCharacterWidth
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      if (line.length > 0) {
        const marks = header && line.number === 1 ? headMarks : cellMarks
        const { cells, delimiters } = splitLine(line.text, delimiter)
        // 구분자가 없는 줄은 칸이 하나뿐이라 색칠도 굵게도 하지 않는다
        if (delimiters.length > 0) {
          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i]
            if (cell.to > cell.from) {
              ranges.push(marks[i % COLUMN_COLORS].range(line.from + cell.from, line.from + cell.to))
            }
            const d = delimiters[i]
            if (d) {
              const gap = (widths[i] ?? 0) - cellWidth(line.text.slice(cell.from, cell.to))
              if (gap > 0) {
                ranges.push(
                  Decoration.widget({ widget: new PadWidget(gap * charW), side: -1 }).range(
                    line.from + cell.to
                  )
                )
              }
              ranges.push(delimiterMark.range(line.from + d.from, line.from + d.to))
            }
          }
        }
      }
      pos = line.to + 1
    }
  }
  return Decoration.set(ranges, true)
}

const csvPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    widths: number[]
    constructor(view: EditorView) {
      const { delimiter } = view.state.field(csvConfigField)
      this.widths = delimiter ? columnWidths(view, delimiter) : []
      this.decorations = buildDecorations(view, this.widths)
    }
    update(update: ViewUpdate): void {
      const { delimiter } = update.state.field(csvConfigField)
      if (update.docChanged && delimiter) this.widths = columnWidths(update.view, delimiter)
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.geometryChanged ||
        update.transactions.some((tr) => tr.annotation(refreshDecorations))
      ) {
        this.decorations = buildDecorations(update.view, this.widths)
      }
    }
  },
  { decorations: (v) => v.decorations }
)

/** 구분자로 나뉜 파일의 열마다 색을 입힌다. delimiter가 null이면 꺼진 상태로 시작한다. */
export function csvColumns(initial: CsvConfig): Extension {
  return [csvConfigField.init(() => initial), csvPlugin]
}
