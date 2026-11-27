import {
  Annotation,
  EditorState,
  Prec,
  Transaction,
  type Extension,
  type Text
} from '@codemirror/state'
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
function inCodeFence(doc: Text, lineNo: number): boolean {
  let fences = 0
  for (let n = 1; n < lineNo; n++) if (/^\s*(```|~~~)/.test(doc.line(n).text)) fences++
  return fences % 2 === 1
}

function tableAt(state: EditorState, pos: number): TableInfo | null {
  return tableAtDoc(state.doc, pos)
}

function tableAtDoc(doc: Text, pos: number): TableInfo | null {
  const cur = doc.lineAt(pos)
  if (!ROW_RE.test(cur.text)) return null
  let first = cur.number
  while (first > 1 && ROW_RE.test(doc.line(first - 1).text)) first--
  let last = cur.number
  while (last < doc.lines && ROW_RE.test(doc.line(last + 1).text)) last++
  if (last - first < 1) return null
  if (inCodeFence(doc, first)) return null
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
function measureOf(el: Element | null): Measure {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!el || !ctx)
    return (t) => [...t].reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) > 0x2e80 ? 1.7 : 1), 0)
  const cs = getComputedStyle(el)
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  return (t) => ctx.measureText(t).width
}

function makeMeasure(view: EditorView): Measure {
  return measureOf(view.contentDOM)
}

function sepCell(align: Align, dashes: number): string {
  const n = Math.max(align === 'center' ? 3 : 2, dashes)
  if (align === 'center') return ':' + '-'.repeat(n - 2) + ':'
  if (align === 'right') return '-'.repeat(n - 1) + ':'
  if (align === 'left') return ':' + '-'.repeat(n - 1)
  return '-'.repeat(n)
}

/** 열마다 가장 긴 칸의 폭(px). 구분선 기본 폭(대시 두 개)보다는 좁아지지 않는다 */
function columnWidths(cells: string[][], measure: Measure, aligns: Align[] = []): number[] {
  const dash = measure('-') || 1
  /** 가운데 정렬 구분선(:-:)은 최소 세 칸이다 */
  const minOf = (i: number): number => dash * (aligns[i] === 'center' ? 3 : 2)
  const widths: number[] = []
  for (const row of cells) {
    row.forEach((c, i) => {
      widths[i] = Math.max(widths[i] ?? minOf(i), measure(c.trim()), minOf(i))
    })
  }
  aligns.forEach((_, i) => {
    widths[i] = Math.max(widths[i] ?? 0, minOf(i))
  })
  return widths
}

/** 열 폭에 맞추려고 글자 뒤에 붙일 공백 개수 */
function padCount(content: string, width: number, measure: Measure): number {
  const space = measure(' ') || 1
  return Math.max(0, Math.round((width - measure(content)) / space))
}

/** 열 폭에 맞는 구분선 대시 개수 */
function dashCount(width: number, measure: Measure): number {
  return Math.max(2, Math.round(width / (measure('-') || 1)))
}

/** 표를 다시 쓰고, 목표 칸의 문서 안 위치를 함께 돌려준다. */
function render(
  info: TableInfo,
  rows: string[][],
  target: { row: number; col: number },
  measure: Measure
): { text: string; start: number; end: number } {
  const widths = columnWidths(
    rows.filter((_, i) => i !== 1),
    measure,
    info.aligns
  )
  const lines: string[] = []
  let start = 0
  let end = 0
  let offset = 0
  rows.forEach((r, i) => {
    let line = '|'
    for (let c = 0; c < info.cols; c++) {
      const w = widths[c] ?? (measure('-') || 1) * 2
      const content = i === 1 ? sepCell(info.aligns[c] ?? 'none', dashCount(w, measure)) : r[c]
      const pad = i === 1 ? 0 : padCount(content, w, measure)
      if (i === target.row && c === target.col) {
        start = offset + line.length + 1
        end = start
      }
      line += ' ' + content + ' '.repeat(pad) + ' |'
    }
    lines.push(line)
    offset += line.length + 1
  })
  return { text: lines.join('\n'), start, end }
}

/** from~to 구간을 insert로 바꾸되, 앞뒤에서 같은 글자는 빼고 실제로 달라진 부분만 변경으로 만든다. */
function minimalChange(doc: Text, from: number, to: number, insert: string): Edit {
  const old = doc.sliceString(from, to)
  let a = 0
  const max = Math.min(old.length, insert.length)
  while (a < max && old[a] === insert[a]) a++
  let b = 0
  while (b < max - a && old[old.length - 1 - b] === insert[insert.length - 1 - b]) b++
  return { from: from + a, to: to - b, insert: insert.slice(a, insert.length - b) }
}

function goTo(
  view: EditorView,
  info: TableInfo,
  rows: string[][],
  target: { row: number; col: number }
): void {
  const out = render(info, rows, target, makeMeasure(view))
  view.dispatch({
    changes: minimalChange(view.state.doc, info.from, info.to, out.text),
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

/** 아직 구분선이 없는 한 줄짜리 헤더(`| a |`)인지 */
function isLoneRow(state: EditorState, lineNo: number): boolean {
  const doc = state.doc
  if (!ROW_RE.test(doc.line(lineNo).text) || inCodeFence(doc, lineNo)) return false
  if (lineNo > 1 && ROW_RE.test(doc.line(lineNo - 1).text)) return false
  if (lineNo < doc.lines && ROW_RE.test(doc.line(lineNo + 1).text)) return false
  return true
}

/** 한 줄짜리 헤더에서 Tab: 다음 칸으로 가고, 마지막 칸이면 오른쪽에 새 칸을 만든다 */
function loneRowTab(view: EditorView, shift: boolean): boolean {
  const { state } = view
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  if (!isLoneRow(state, line.number)) return false
  const p = pipePositions(line.text)
  const cells = p.length - 1
  if (cells < 1) return false
  const col = Math.min(cells - 1, columnAt(line.text, head - line.from))
  if (shift) {
    if (col === 0) return true
    view.dispatch({ selection: { anchor: line.from + p[col - 1] + 2 }, scrollIntoView: true })
    return true
  }
  if (col < cells - 1) {
    view.dispatch({ selection: { anchor: line.from + p[col + 1] + 2 }, scrollIntoView: true })
    return true
  }
  const body = line.text.trimEnd()
  view.dispatch({
    changes: { from: line.from + body.length, to: line.to, insert: '  |' },
    selection: { anchor: line.from + body.length + 1 },
    scrollIntoView: true,
    userEvent: 'input.table'
  })
  return true
}

function next(view: EditorView, shift: boolean): boolean {
  const sel = view.state.selection.main
  const info = tableAt(view.state, sel.head)
  if (!info) return loneRowTab(view, shift)
  let { row, col } = info
  const rows = info.rows
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
      const widened: TableInfo = {
        ...info,
        cols: info.cols + 1,
        aligns: [...info.aligns, 'none']
      }
      goTo(
        view,
        widened,
        info.rows.map((r) => [...r, '']),
        { row: info.row === 1 ? 2 : info.row, col: info.cols }
      )
      return true
    }
  }
  goTo(view, info, rows, { row, col })
  return true
}

/** 표 바로 아래 줄에 글자가 있으면 true. 표와 한 덩어리로 읽히지 않게 빈 줄을 넣어야 한다 */
function needsBlankAfter(state: EditorState, lineNo: number): boolean {
  if (lineNo >= state.doc.lines) return false
  return state.doc.line(lineNo + 1).text.trim() !== ''
}

/** 헤더 줄(| 이름 | 나이 |)에서 Enter를 치면 구분선(|---|---|)과 빈 행을 자동으로 붙인다 */
function headerEnter(view: EditorView): boolean {
  const { state } = view
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  if (!ROW_RE.test(line.text)) return false
  if (line.number > 1 && ROW_RE.test(state.doc.line(line.number - 1).text)) return false
  if (line.number < state.doc.lines && ROW_RE.test(state.doc.line(line.number + 1).text))
    return false
  if (inCodeFence(state.doc, line.number)) return false
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
  const out = render(info, info.rows, { row: 2, col: 0 }, makeMeasure(view))
  view.dispatch({
    changes: minimalChange(
      state.doc,
      info.from,
      info.to,
      out.text + (needsBlankAfter(state, line.number) ? '\n' : '')
    ),
    selection: { anchor: info.from + out.start, head: info.from + out.end },
    scrollIntoView: true,
    userEvent: 'input.table'
  })
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
  if (info.row >= 2 && info.row === rows.length - 1 && rows[info.row].every((c) => c === '')) {
    const line = view.state.doc.lineAt(sel.head)
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
      scrollIntoView: true,
      annotations: normalizing.of(true),
      userEvent: 'delete.table'
    })
    return true
  }
  const row = info.row <= 1 ? 2 : info.row + 1
  if (row >= rows.length) rows = withNewRow(info)
  goTo(view, info, rows, { row, col: 0 })
  return true
}

/** 헤더 줄 끝에서 `|`로 칸을 닫을 때마다 구분선과 빈 행을 붙이고, 칸이 늘면 열도 같이 늘린다. */
const autoTable: Extension = EditorView.inputHandler.of((view, from, to, text) => {
  if (text !== '|' || from !== to) return false
  const { state } = view
  const line = state.doc.lineAt(from)
  if (from !== line.to || inCodeFence(state.doc, line.number)) return false
  if (line.text.trim() === '') {
    const near = (n: number): boolean =>
      n >= 1 && n <= state.doc.lines && ROW_RE.test(state.doc.line(n).text)
    if (near(line.number - 1) || near(line.number + 1)) return false
    view.dispatch({
      changes: { from, insert: '|  |' },
      selection: { anchor: from + 2 },
      userEvent: 'input.type'
    })
    return true
  }
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
    const next = state.update({
      changes: { from, insert: '|' },
      annotations: normalizing.of(true)
    }).state
    const found = tableAt(next, from + 1)
    if (!found || found.row !== 0) return false
    info = found
    replaceTo = found.to - 1
  } else return false

  const out = render(info, info.rows, { row: 0, col: 0 }, makeMeasure(view))
  const headerLen = out.text.indexOf('\n')
  const insert = out.text + (!hasNext && needsBlankAfter(state, line.number) ? '\n' : '')
  view.dispatch({
    changes: minimalChange(state.doc, info.from, replaceTo, insert),
    selection: { anchor: info.from + headerLen },
    scrollIntoView: true,
    userEvent: 'input.table'
  })
  return true
})

const normalizing = Annotation.define<boolean>()

/** 이스케이프되지 않은 | 의 위치 */
function pipePositions(text: string): number[] {
  const pos: number[] = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && text[i + 1] === '|') i++
    else if (text[i] === '|') pos.push(i)
  }
  return pos
}

interface Edit {
  from: number
  to: number
  insert: string
}

/** 표 한 개의 모든 칸을 `| 글자 |`(앞뒤 공백 하나)로 맞추는 변경 목록(문서 좌표). */
function normalizeEdits(
  doc: Text,
  firstLine: number,
  lastLine: number,
  cursor: number,
  measure: Measure
): Edit[] {
  const edits: Edit[] = []
  const cells: string[][] = []
  for (let n = firstLine; n <= lastLine; n++) {
    if (n === firstLine + 1) continue
    const text = doc.line(n).text
    const p = pipePositions(text)
    const row: string[] = []
    for (let i = 0; i + 1 < p.length; i++) row.push(text.slice(p[i] + 1, p[i + 1]))
    cells.push(row)
  }
  const sepText = doc.line(firstLine + 1).text
  const sp = pipePositions(sepText)
  const aligns: Align[] = []
  for (let i = 0; i + 1 < sp.length; i++)
    aligns.push(parseAlign(sepText.slice(sp[i] + 1, sp[i + 1]).trim()))
  const widths = columnWidths(cells, measure, aligns)
  for (let n = firstLine; n <= lastLine; n++) {
    const line = doc.line(n)
    const p = pipePositions(line.text)
    for (let i = 0; i + 1 < p.length; i++) {
      const s = p[i] + 1
      const e = p[i + 1]
      const content = line.text.slice(s, e)
      const trimmed = content.trim()
      const inCell = cursor >= line.from + s && cursor <= line.from + e
      const w = widths[i] ?? (measure('-') || 1) * 2
      if (n === firstLine + 1) {
        if (!/^:?-+:?$/.test(trimmed) || inCell) continue
        const want = ' ' + sepCell(parseAlign(trimmed), dashCount(w, measure)) + ' '
        if (content !== want) edits.push({ from: line.from + s, to: line.from + e, insert: want })
        continue
      }
      if (trimmed === '') {
        const want = ' '.repeat(2 + padCount('', w, measure))
        if (content !== want && !(inCell && content.length > 0)) {
          edits.push({ from: line.from + s, to: line.from + e, insert: want })
        }
        continue
      }
      const lead = content.length - content.trimStart().length
      const lastNon = content.trimEnd().length
      const cursorOff = inCell ? cursor - (line.from + s) : -1
      const textEnd = cursorOff > lastNon ? Math.min(cursorOff, content.length) : lastNon
      const wantTail = ' '.repeat(1 + padCount(content.slice(lead, textEnd), w, measure))
      if (lead !== 1) {
        edits.push({ from: line.from + s, to: line.from + s + lead, insert: ' ' })
      }
      if (content.slice(textEnd) !== wantTail) {
        edits.push({ from: line.from + s + textEnd, to: line.from + e, insert: wantTail })
      }
    }
  }
  return edits
}

/** 표 안의 글자를 고칠 때마다 표 칸을 실시간으로 `| 글자 |`로 정렬한다. 커서만 옮길 때는 문서를 건드리지 않는다 */
const tableNormalize: Extension = EditorState.transactionFilter.of((tr) => {
  if (tr.annotation(normalizing)) return tr
  if (!tr.docChanged) return tr
  if (tr.isUserEvent('input.type.compose')) return tr
  const doc = tr.newDoc
  const lines = new Set<number>()
  tr.changes.iterChangedRanges((_fa, _ta, fromB, toB) => {
    for (let n = doc.lineAt(fromB).number; n <= doc.lineAt(toB).number; n++) lines.add(n)
  })
  const cursor = tr.newSelection.main.head
  const measure = measureOf(document.querySelector('.cm-content'))
  const seen = new Set<number>()
  const edits: Edit[] = []
  for (const n of lines) {
    const info = tableAtDoc(doc, doc.line(n).from)
    if (!info) continue
    const first = doc.lineAt(info.from).number
    if (seen.has(first)) continue
    seen.add(first)
    edits.push(...normalizeEdits(doc, first, doc.lineAt(info.to).number, cursor, measure))
  }
  if (edits.length === 0) return tr
  return [
    tr,
    {
      changes: edits,
      sequential: true,
      annotations: [normalizing.of(true), Transaction.userEvent.of('input.table')]
    }
  ]
})

let composing = false

const tableNormalizeOnLeave: Extension = [
  EditorView.domEventHandlers({
    compositionstart: () => {
      composing = true
      return false
    },
    compositionend: () => {
      composing = false
      return false
    }
  }),
  EditorState.transactionFilter.of((tr) => {
    if (tr.docChanged || !tr.selection || tr.annotation(normalizing) || composing) return tr
    const doc = tr.startState.doc
    const info = tableAtDoc(doc, tr.startState.selection.main.head)
    if (!info) return tr
    const edits = normalizeEdits(
      doc,
      doc.lineAt(info.from).number,
      doc.lineAt(info.to).number,
      tr.newSelection.main.head,
      measureOf(document.querySelector('.cm-content'))
    )
    if (edits.length === 0) return tr
    return [
      tr,
      {
        changes: edits,
        sequential: true,
        annotations: [normalizing.of(true), Transaction.userEvent.of('input.table')]
      }
    ]
  })
]

/** 표의 칸 한가운데에 `|`를 쳐서 칸을 나누면 그 행만 칸이 늘어난다. */
const tableColumnSync: Extension = EditorState.transactionFilter.of((tr) => {
  if (tr.annotation(normalizing) || !tr.docChanged || !tr.isUserEvent('input.type')) return tr
  if (tr.isUserEvent('input.type.compose')) return tr
  let pos = -1
  let count = 0
  let typedPipe = false
  tr.changes.iterChanges((fa, ta, fb, _tb, ins) => {
    count++
    typedPipe = fa === ta && ins.toString() === '|'
    pos = fb
  })
  if (count !== 1 || !typedPipe) return tr
  const doc = tr.newDoc
  if (pos > 0 && doc.sliceString(pos - 1, pos) === '\\') return tr
  const info = tableAtDoc(doc, pos)
  if (!info) return tr
  const typed = doc.lineAt(pos)
  const first = doc.lineAt(info.from).number
  const last = doc.lineAt(info.to).number
  const typedPipes = pipePositions(typed.text)
  const idx = pipePositions(typed.text.slice(0, pos - typed.from)).length
  const typedCells = typedPipes.length - 1
  if (idx < 1 || typedCells < 2) return tr
  const edits: Edit[] = []
  for (let n = first; n <= last; n++) {
    if (n === typed.number) continue
    const line = doc.line(n)
    const p = pipePositions(line.text)
    if (p.length - 1 !== typedCells - 1) continue
    const at = idx < p.length ? line.from + p[idx] + 1 : line.to
    edits.push({ from: at, to: at, insert: n === first + 1 ? ' --- |' : '  |' })
  }
  if (edits.length === 0) return tr
  return [
    tr,
    { changes: edits, sequential: true, annotations: [Transaction.userEvent.of('input.table')] }
  ]
})

/** 이미 있는 표의 헤더 줄 끝에서 마지막 `|` 뒤에 글자를 쳐서 닫지 않은 새 칸이 생겼을 때의 변경 목록. */
function closeHeaderEdits(doc: Text, head: number): Edit[] | null {
  const line = doc.lineAt(head)
  const text = line.text
  if (head !== line.to || ROW_RE.test(text) || !text.trimStart().startsWith('|')) return null
  if (line.number >= doc.lines || inCodeFence(doc, line.number)) return null
  if (line.number > 1 && ROW_RE.test(doc.line(line.number - 1).text)) return null
  const sep = doc.line(line.number + 1).text
  if (!ROW_RE.test(sep) || !SEP_RE.test(sep)) return null
  const p = pipePositions(text)
  const closed = p.length - 1
  if (closed < 1 || text.slice(p[p.length - 1] + 1).trim() === '') return null
  const sepCells = pipePositions(sep).length - 1
  if (closed !== sepCells) return null
  const edits: Edit[] = [{ from: line.from + text.trimEnd().length, to: line.from + text.trimEnd().length, insert: ' |' }]
  for (let n = line.number + 1; n <= doc.lines; n++) {
    const row = doc.line(n)
    if (!ROW_RE.test(row.text)) break
    if (pipePositions(row.text).length - 1 !== sepCells) continue
    const at = row.from + row.text.trimEnd().length
    edits.push({ from: at, to: at, insert: n === line.number + 1 ? ' -- |' : '  |' })
  }
  return edits
}

/** 헤더 줄 끝에서 `| a |ls`처럼 닫지 않은 새 칸을 치면 바로 ` |`로 닫고 열을 맞춘다 */
const tableAutoClose: Extension = EditorState.transactionFilter.of((tr) => {
  if (tr.annotation(normalizing) || !tr.docChanged || !tr.isUserEvent('input.type')) return tr
  if (tr.isUserEvent('input.type.compose')) return tr
  const edits = closeHeaderEdits(tr.newDoc, tr.newSelection.main.head)
  if (!edits) return tr
  return [
    tr,
    { changes: edits, sequential: true, annotations: [Transaction.userEvent.of('input.table')] }
  ]
})

/** 헤더 줄에서 칸(`b |`)을 지워 헤더의 칸 수가 구분선보다 줄면, 그 열을 구분선과 나머지 행에서도 지운다. */
const tableColumnDelete: Extension = EditorState.transactionFilter.of((tr) => {
  if (tr.annotation(normalizing) || !tr.docChanged) return tr
  if (!tr.isUserEvent('delete') && !tr.isUserEvent('input.type.compose')) return tr
  let count = 0
  let pos = -1
  let removedOnly = true
  tr.changes.iterChanges((fa, ta, fb, tb) => {
    count++
    pos = fb
    if (fb !== tb) removedOnly = false
    if (tr.startState.doc.sliceString(fa, ta).includes('\n')) removedOnly = false
  })
  if (count !== 1 || !removedOnly) return tr
  const oldDoc = tr.startState.doc
  const doc = tr.newDoc
  const line = doc.lineAt(pos)
  if (line.number >= doc.lines || inCodeFence(doc, line.number)) return tr
  const sepLine = doc.line(line.number + 1)
  if (!SEP_RE.test(sepLine.text) || !ROW_RE.test(sepLine.text)) return tr
  if (line.number > 1 && ROW_RE.test(doc.line(line.number - 1).text)) return tr
  const oldLine = oldDoc.line(line.number)
  if (!ROW_RE.test(line.text) && !line.text.trimStart().startsWith('|')) return tr
  const trimmed = (cells: string[]): string[] => cells.map((c) => c.trim())
  const before = trimmed(splitRow(oldLine.text))
  const after = trimmed(splitRow(line.text))
  const sepCells = pipePositions(sepLine.text).length - 1
  const k = sepCells - after.length
  if (k <= 0 || before.length - after.length !== k) return tr
  let p0 = 0
  while (p0 < after.length && before[p0] === after[p0]) p0++
  let s0 = 0
  while (s0 < after.length - p0 && before[before.length - 1 - s0] === after[after.length - 1 - s0])
    s0++
  if (p0 + s0 < after.length) return tr
  const idx = p0
  const edits: Edit[] = []
  for (let n = line.number + 1; n <= doc.lines; n++) {
    const text = doc.line(n).text
    if (!ROW_RE.test(text)) break
    const p = pipePositions(text)
    if (p.length - 1 !== sepCells || idx + k >= p.length) continue
    const base = doc.line(n).from
    edits.push({ from: base + p[idx], to: base + p[idx + k], insert: '' })
  }
  if (edits.length === 0) return tr
  const kept = line.text.trimEnd().length
  if (kept < line.text.length) edits.unshift({ from: line.from + kept, to: line.to, insert: '' })
  const lastCol = idx === after.length
  return [
    tr,
    {
      changes: edits,
      sequential: true,
      ...(lastCol ? { selection: { anchor: line.from + kept } } : {}),
      annotations: [Transaction.userEvent.of('delete.table')]
    }
  ]
})

const tableNormalizeAfterCompose: Extension = EditorView.domEventHandlers({
  compositionend: (_e, view) => {
    setTimeout(() => {
      if (view.composing || view.compositionStarted) return
      const closing = closeHeaderEdits(view.state.doc, view.state.selection.main.head)
      if (closing) view.dispatch({ changes: closing, userEvent: 'input.table' })
      const { state } = view
      const head = state.selection.main.head
      const info = tableAtDoc(state.doc, head)
      if (!info) return
      const edits = normalizeEdits(
        state.doc,
        state.doc.lineAt(info.from).number,
        state.doc.lineAt(info.to).number,
        head,
        measureOf(view.contentDOM)
      )
      if (edits.length === 0) return
      view.dispatch({
        changes: edits,
        annotations: [normalizing.of(true), Transaction.userEvent.of('input.table')]
      })
    }, 30)
    return false
  }
})

/** 칸이 모두 빈 본문 행(`|  |`)에서 바깥쪽 `|`를 지우면 그 행을 통째로 지운다. */
function deleteEmptyRow(view: EditorView, forward: boolean): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const info = tableAt(state, sel.head)
  if (!info || info.row < 2) return false
  if (!info.rows[info.row].every((c) => c === '')) return false
  const line = state.doc.lineAt(sel.head)
  const lead = line.text.length - line.text.trimStart().length
  const end = line.text.trimEnd().length
  const off = sel.head - line.from
  const hitsOuter = forward ? off === lead || off === end - 1 : off === lead + 1 || off === end
  if (!hitsOuter) return false
  const prev = state.doc.line(line.number - 1)
  view.dispatch({
    changes: { from: prev.to, to: line.to },
    selection: { anchor: prev.to },
    scrollIntoView: true,
    userEvent: 'delete.table'
  })
  return true
}

export const tableEdit: Extension = [
  autoTable,
  tableNormalize,
  tableNormalizeOnLeave,
  tableColumnSync,
  tableAutoClose,
  tableColumnDelete,
  tableNormalizeAfterCompose,
  Prec.high(
    keymap.of([
      { key: 'Tab', run: (v) => next(v, false) },
      { key: 'Shift-Tab', run: (v) => next(v, true) },
      { key: 'Enter', run: enter },
      { key: 'Backspace', run: (v) => deleteEmptyRow(v, false) },
      { key: 'Delete', run: (v) => deleteEmptyRow(v, true) }
    ])
  )
]
