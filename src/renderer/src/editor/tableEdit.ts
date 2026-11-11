import { Prec, type EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { completionStatus } from '@codemirror/autocomplete'

type Align = 'left' | 'center' | 'right' | 'none'

interface TableInfo {
  from: number
  to: number
  rows: string[][]
  aligns: Align[]
  cols: number
  row: number
  col: number
}

const ROW_RE = /^\s*\|.*\|\s*$/
const SEP_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

/** 이스케이프된 \| 는 칸 구분으로 보지 않고 나눈다. 바깥 파이프는 떼어 낸다 */
function splitRow(text: string): string[] {
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\\' && text[i + 1] === '|') {
      cur += '\\|'
      i++
    } else if (ch === '|') {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  cells.push(cur)
  const t = text.trim()
  if (t.startsWith('|')) cells.shift()
  if (t.endsWith('|') && !t.endsWith('\\|')) cells.pop()
  return cells.map((c) => c.trim())
}

/** 커서 앞에 칸 구분 파이프가 몇 개인지로 몇 번째 칸인지 센다 */
function columnAt(lineText: string, offset: number): number {
  const lead = lineText.length - lineText.trimStart().length
  let pipes = 0
  for (let i = 0; i < offset; i++) {
    if (lineText[i] === '\\' && lineText[i + 1] === '|') i++
    else if (lineText[i] === '|') pipes++
  }
  return Math.max(0, pipes - (offset > lead && lineText.trimStart().startsWith('|') ? 1 : 0))
}

function parseAlign(cell: string): Align {
  const l = cell.startsWith(':')
  const r = cell.endsWith(':')
  return l && r ? 'center' : r ? 'right' : l ? 'left' : 'none'
}

/** 코드 블록 안의 표 모양 글은 건드리지 않는다 */
function inCodeFence(state: EditorState, lineNo: number): boolean {
  let fences = 0
  for (let n = 1; n < lineNo; n++) if (/^\s*(```|~~~)/.test(state.doc.line(n).text)) fences++
  return fences % 2 === 1
}

function tableAt(state: EditorState, pos: number): TableInfo | null {
  const doc = state.doc
  const cur = doc.lineAt(pos)
  if (!ROW_RE.test(cur.text)) return null
  let first = cur.number
  while (first > 1 && ROW_RE.test(doc.line(first - 1).text)) first--
  let last = cur.number
  while (last < doc.lines && ROW_RE.test(doc.line(last + 1).text)) last++
  if (last - first < 1) return null
  if (inCodeFence(state, first)) return null
  const sepLine = doc.line(first + 1).text
  if (!SEP_RE.test(sepLine)) return null

  const rows: string[][] = []
  for (let n = first; n <= last; n++) rows.push(splitRow(doc.line(n).text))
  const cols = Math.max(...rows.map((r) => r.length))
  for (const r of rows) while (r.length < cols) r.push('')
  const aligns = rows[1].map(parseAlign)
  return {
    from: doc.line(first).from,
    to: doc.line(last).to,
    rows,
    aligns,
    cols,
    row: cur.number - first,
    col: Math.min(cols - 1, columnAt(cur.text, pos - cur.from))
  }
}

type Measure = (text: string) => number

/** 에디터 글꼴로 글자 폭을 잰다. 한글처럼 글꼴마다 폭이 다른 글자도 실제 폭으로 맞추기 위함 */
function makeMeasure(view: EditorView): Measure {
  const cs = getComputedStyle(view.contentDOM)
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return (t) => t.length * view.defaultCharacterWidth
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  return (t) => ctx.measureText(t).width
}

function sepCell(align: Align, dashes: number): string {
  if (align === 'center') return ':' + '-'.repeat(dashes - 2) + ':'
  if (align === 'right') return '-'.repeat(dashes - 1) + ':'
  if (align === 'left') return ':' + '-'.repeat(dashes - 1)
  return '-'.repeat(dashes)
}

function pad(cell: string, width: number, align: Align, measure: Measure, space: number): string {
  const gap = Math.max(0, Math.round((width - measure(cell)) / space))
  if (gap === 0) return cell
  if (align === 'right') return ' '.repeat(gap) + cell
  if (align === 'center') {
    const left = Math.floor(gap / 2)
    return ' '.repeat(left) + cell + ' '.repeat(gap - left)
  }
  return cell + ' '.repeat(gap)
}

/** 표를 열 너비에 맞춰 다시 쓰고, 목표 칸의 문서 안 위치를 함께 돌려준다 */
function render(
  info: TableInfo,
  rows: string[][],
  target: { row: number; col: number },
  measure: Measure
): { text: string; start: number; end: number } {
  const space = measure(' ') || 1
  const dash = measure('-') || space
  const widths: number[] = []
  for (let c = 0; c < info.cols; c++) {
    let w = dash * 3
    rows.forEach((r, i) => {
      if (i !== 1) w = Math.max(w, measure(r[c]))
    })
    widths.push(w)
  }
  // 모든 열을 표에서 가장 긴 칸에 맞춰 같은 폭으로 통일한다
  const widest = Math.max(...widths)
  widths.fill(widest)
  const lines: string[] = []
  let start = 0
  let end = 0
  let offset = 0
  rows.forEach((r, i) => {
    let line = '|'
    for (let c = 0; c < info.cols; c++) {
      const align = info.aligns[c] ?? 'none'
      const body =
        i === 1
          ? sepCell(align, Math.max(3, Math.round(widths[c] / dash)))
          : pad(r[c], widths[c], align, measure, space)
      if (i === target.row && c === target.col) {
        // 빈 칸은 공백뿐이라 trimStart로 재면 오른쪽 끝이 되므로 왼쪽 끝에 둔다
        const lead = r[c] === '' ? 0 : body.length - body.trimStart().length
        start = offset + line.length + 1 + lead
        end = start + r[c].length
      }
      line += ' ' + body + ' |'
    }
    lines.push(line)
    offset += line.length + 1
  })
  return { text: lines.join('\n'), start, end }
}

function goTo(
  view: EditorView,
  info: TableInfo,
  rows: string[][],
  target: { row: number; col: number }
): void {
  const out = render(info, rows, target, makeMeasure(view))
  view.dispatch({
    changes: { from: info.from, to: info.to, insert: out.text },
    selection: { anchor: info.from + out.start, head: info.from + out.end },
    scrollIntoView: true,
    userEvent: 'input.table'
  })
}

function withNewRow(info: TableInfo): string[][] {
  return [...info.rows, Array.from({ length: info.cols }, () => '')]
}

/** 구분선 줄(1)은 건너뛴다 */
function skipSep(row: number, dir: 1 | -1): number {
  return row === 1 ? row + dir : row
}

function next(view: EditorView, shift: boolean): boolean {
  const sel = view.state.selection.main
  const info = tableAt(view.state, sel.head)
  if (!info) return false
  let { row, col } = info
  let rows = info.rows
  if (shift) {
    col--
    if (col < 0) {
      row = skipSep(row - 1, -1)
      col = info.cols - 1
    }
    if (row < 0) return true
  } else {
    col++
    if (col >= info.cols) {
      row = skipSep(row + 1, 1)
      col = 0
    }
    if (row === 1) row = 2
    if (row >= rows.length) rows = withNewRow(info)
  }
  goTo(view, info, rows, { row, col })
  return true
}

/** 헤더 줄(| 이름 | 나이 |)에서 Enter를 치면 구분선(|---|---|)과 빈 행을 자동으로 붙인다 */
function headerEnter(view: EditorView): boolean {
  const { state } = view
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  if (!ROW_RE.test(line.text) || head !== line.to) return false
  if (line.number > 1 && ROW_RE.test(state.doc.line(line.number - 1).text)) return false
  if (line.number < state.doc.lines && ROW_RE.test(state.doc.line(line.number + 1).text))
    return false
  if (inCodeFence(state, line.number)) return false
  const header = splitRow(line.text)
  if (header.every((c) => c === '')) return false
  const cols = header.length
  const info: TableInfo = {
    from: line.from,
    to: line.to,
    rows: [header, header.map(() => '---'), header.map(() => '')],
    aligns: header.map(() => 'none'),
    cols,
    row: 0,
    col: 0
  }
  goTo(view, info, info.rows, { row: 2, col: 0 })
  return true
}

function enter(view: EditorView): boolean {
  if (completionStatus(view.state) !== null) return false
  const sel = view.state.selection.main
  if (!sel.empty && view.state.doc.lineAt(sel.from).number !== view.state.doc.lineAt(sel.to).number)
    return false
  const info = tableAt(view.state, sel.head)
  if (!info) return headerEnter(view)
  let rows = info.rows
  const row = info.row <= 1 ? 2 : info.row + 1
  if (row >= rows.length) rows = withNewRow(info)
  goTo(view, info, rows, { row, col: info.col })
  return true
}

/**
 * 헤더 줄 끝에서 `|`로 칸을 닫을 때마다 구분선과 빈 행을 붙이고, 칸이 늘면 열도 같이 늘린다.
 * 커서는 헤더 줄 끝에 둬서 이어서 다음 칸을 칠 수 있다.
 */
const autoTable: Extension = EditorView.inputHandler.of((view, from, to, text) => {
  if (text !== '|' || from !== to) return false
  const { state } = view
  const line = state.doc.lineAt(from)
  if (from !== line.to || inCodeFence(state, line.number)) return false
  const typed = line.text + '|'
  if (!ROW_RE.test(typed)) return false
  const hasPrev = line.number > 1 && ROW_RE.test(state.doc.line(line.number - 1).text)
  const hasNext = line.number < state.doc.lines && ROW_RE.test(state.doc.line(line.number + 1).text)

  let info: TableInfo | null = null
  let replaceTo = line.to
  if (!hasPrev && !hasNext) {
    const header = splitRow(typed)
    if (header.every((c) => c === '')) return false
    info = {
      from: line.from,
      to: line.to,
      rows: [header, header.map(() => '---'), header.map(() => '')],
      aligns: header.map(() => 'none'),
      cols: header.length,
      row: 0,
      col: 0
    }
  } else if (!hasPrev && hasNext) {
    // 이미 있는 표의 헤더에 칸을 더하는 경우
    const next = state.update({ changes: { from, insert: '|' } }).state
    const found = tableAt(next, from + 1)
    if (!found || found.row !== 0) return false
    info = found
    replaceTo = found.to - 1
  } else return false

  const out = render(info, info.rows, { row: 0, col: 0 }, makeMeasure(view))
  const headerLen = out.text.indexOf('\n')
  view.dispatch({
    changes: { from: info.from, to: replaceTo, insert: out.text },
    selection: { anchor: info.from + headerLen },
    scrollIntoView: true,
    userEvent: 'input.table'
  })
  return true
})

/** 표 안에서 Tab/Shift+Tab으로 칸을 옮기고, 끝에서 새 행을 만들며, 옮길 때마다 열 너비를 맞춘다 */
export const tableEdit: Extension = [
  autoTable,
  Prec.high(
    keymap.of([
      { key: 'Tab', run: (v) => next(v, false) },
      { key: 'Shift-Tab', run: (v) => next(v, true) },
      { key: 'Enter', run: enter }
    ])
  )
]
