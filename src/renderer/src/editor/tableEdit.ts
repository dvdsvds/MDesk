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
  // 구분선은 기본 -- 두 개. 가운데 정렬(:-:)은 대시가 하나 이상 있어야 한다
  const n = Math.max(align === 'center' ? 3 : 2, dashes)
  if (align === 'center') return ':' + '-'.repeat(n - 2) + ':'
  if (align === 'right') return '-'.repeat(n - 1) + ':'
  if (align === 'left') return ':' + '-'.repeat(n - 1)
  return '-'.repeat(n)
}

/** 열마다 가장 긴 칸의 폭(px). 구분선 기본 폭(대시 두 개)보다는 좁아지지 않는다 */
function columnWidths(cells: string[][], measure: Measure, aligns: Align[] = []): number[] {
  const dash = measure('-') || 1
  // 가운데 정렬 구분선(:-:)은 최소 세 칸이다
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

/**
 * 표를 다시 쓰고, 목표 칸의 문서 안 위치를 함께 돌려준다.
 * 열마다 가장 긴 칸에 맞춰 글자 뒤를 공백으로 채우고, 구분선 -도 그 폭으로 맞춘다(기본 --).
 * 가장 긴 칸은 글자 앞뒤 공백이 딱 하나씩이다
 */
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
        // 칸으로 이동하면 커서는 늘 `| ` 바로 뒤(칸 글자의 맨 앞)에 놓인다. 글자를 선택하지 않는다
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
      // 마지막 칸에서 Tab: 오른쪽에 새 열을 만들고 같은 행의 새 칸으로 간다 (새 행은 Enter)
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
  // 줄 끝이 아니어도(`| a |`의 칸 안) Enter로 구분선과 빈 행을 붙인다
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
    changes: {
      from: info.from,
      to: info.to,
      insert: out.text + (needsBlankAfter(state, line.number) ? '\n' : '')
    },
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
  if (from !== line.to || inCodeFence(state.doc, line.number)) return false
  // 빈 줄에서 처음 `|`를 치면 `|  |`로 닫고 커서를 안쪽 칸에 둔다. 이어서 글자를 치면 `| a |`가 된다
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
    // 이미 있는 표의 헤더에 칸을 더하는 경우
    // 닫는 |가 들어간 모습을 미리 계산해 볼 뿐이라, 실시간 정렬 필터는 건너뛴다(공백이 채워지면 위치가 어긋난다)
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
  // 표는 빈 줄을 만나야 끝나서, 바로 아래에 글자가 붙어 있으면 그 줄이 표의 행으로 읽힌다. 빈 줄로 떼어 놓는다
  // (이미 표가 있는 헤더에 칸만 더하는 경우에는 아래 빈 줄이 이미 있으니 더하지 않는다)
  const insert = out.text + (!hasNext && needsBlankAfter(state, line.number) ? '\n' : '')
  view.dispatch({
    changes: { from: info.from, to: replaceTo, insert },
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

/**
 * 표 한 개의 모든 칸을 `| 글자 |`(앞뒤 공백 하나)로 맞추는 변경 목록(문서 좌표).
 * 커서가 있는 칸은 스페이스를 연달아 칠 수 있게 공백이 늘어난 것은 두고, 부족한 것만 채운다.
 * 커서가 칸을 벗어나면 다음 입력·이동 때 정리된다
 */
function normalizeEdits(
  doc: Text,
  firstLine: number,
  lastLine: number,
  cursor: number,
  measure: Measure
): Edit[] {
  const edits: Edit[] = []
  // 열마다 가장 긴 칸의 폭 (구분선 줄은 빼고 잰다)
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
      // 맨 앞 공백 하나, 글자 뒤는 열 폭에 맞춘 채움 공백 + 공백 하나.
      if (trimmed === '') {
        const want = ' '.repeat(2 + padCount('', w, measure))
        if (content !== want && !(inCell && content.length > 0)) {
          edits.push({ from: line.from + s, to: line.from + e, insert: want })
        }
        continue
      }
      const lead = content.length - content.trimStart().length
      const lastNon = content.trimEnd().length
      // 커서가 글자 바로 뒤의 공백 구간에 있으면 커서까지는 글자로 본다(단어 사이 스페이스를 칠 수 있게)
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
  // 한글 조합 중에는 건드리지 않는다. 조합이 끝난 뒤 다음 입력 때 정리된다
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

/**
 * 표의 칸 한가운데에 `|`를 쳐서 칸을 나누면 그 행만 칸이 늘어난다.
 * 헤더와 구분선의 칸 수가 다르면 표로 인식되지 않아 박스가 풀리므로, 나머지 행에도 같은 자리에 빈 칸을 넣어 맞춘다.
 * (칸 수가 이미 어긋나 있던 행은 건드리지 않는다)
 */
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
  // 앞이 \ 면 이스케이프된 파이프라서 칸을 나누지 않는다
  if (pos > 0 && doc.sliceString(pos - 1, pos) === '\\') return tr
  const info = tableAtDoc(doc, pos)
  if (!info) return tr
  const typed = doc.lineAt(pos)
  const first = doc.lineAt(info.from).number
  const last = doc.lineAt(info.to).number
  const typedPipes = pipePositions(typed.text)
  const idx = pipePositions(typed.text.slice(0, pos - typed.from)).length // 새로 생긴 칸의 열 번호
  const typedCells = typedPipes.length - 1
  if (idx < 1 || typedCells < 2) return tr
  const edits: Edit[] = []
  for (let n = first; n <= last; n++) {
    if (n === typed.number) continue
    const line = doc.line(n)
    const p = pipePositions(line.text)
    if (p.length - 1 !== typedCells - 1) continue
    // 새 칸의 열 번호(idx)와 같은 자리, 즉 idx번째 파이프 바로 뒤에 빈 칸을 끼운다. 그 파이프가 없으면 줄 끝에 붙인다
    const at = idx < p.length ? line.from + p[idx] + 1 : line.to
    edits.push({ from: at, to: at, insert: n === first + 1 ? ' --- |' : '  |' })
  }
  if (edits.length === 0) return tr
  return [
    tr,
    { changes: edits, sequential: true, annotations: [Transaction.userEvent.of('input.table')] }
  ]
})

/**
 * 헤더 줄에서 칸(`b |`)을 지워 헤더의 칸 수가 구분선보다 줄면, 그 열을 구분선과 나머지 행에서도 지운다.
 * 헤더와 구분선의 칸 수가 다르면 표가 풀리기 때문이다.
 * 지워진 열의 자리는 지우기 전후 칸 목록을 비교해 찾는다(맨 끝부터 한 글자씩 지워도 같다).
 * 두 칸이 합쳐진 경우처럼 어느 칸이 지워졌는지 정해지지 않으면 아무것도 하지 않는다
 */
const tableColumnDelete: Extension = EditorState.transactionFilter.of((tr) => {
  if (tr.annotation(normalizing) || !tr.docChanged || !tr.isUserEvent('delete')) return tr
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
  return [
    tr,
    { changes: edits, sequential: true, annotations: [Transaction.userEvent.of('delete.table')] }
  ]
})

/**
 * 한글 조합 중에는 정렬을 건너뛰므로, 조합이 끝나면 커서가 있는 표를 한 번 정리한다.
 * (처음 칸에 있던 빈칸이 그대로 남아 `| 가상환경  |`처럼 공백이 둘이 되는 것을 막는다)
 */
const tableNormalizeAfterCompose: Extension = EditorView.domEventHandlers({
  compositionend: (_e, view) => {
    // 에디터가 조합 결과를 문서에 반영한 다음에 정리한다
    setTimeout(() => {
      // 다음 글자 조합이 벌써 시작됐으면 건드리지 않는다. 조합 중에 문서를 고치면 IME가 글자를 한 번 더 넣는다("밖에서서").
      // 그 조합이 끝날 때 이 핸들러가 다시 돌아 정리한다
      if (view.composing || view.compositionStarted) return
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

/** 표 안에서 Tab/Shift+Tab으로 칸을 옮기고, 끝에서 새 행을 만들며, 옮길 때마다 열 너비를 맞춘다 */
export const tableEdit: Extension = [
  autoTable,
  tableNormalize,
  // 필터는 뒤에서부터 실행된다. 칸을 먼저 맞춘 다음 정렬이 그 결과를 이어받도록 정렬 필터 뒤에 둔다
  tableColumnSync,
  tableColumnDelete,
  tableNormalizeAfterCompose,
  Prec.high(
    keymap.of([
      { key: 'Tab', run: (v) => next(v, false) },
      { key: 'Shift-Tab', run: (v) => next(v, true) },
      { key: 'Enter', run: enter }
    ])
  )
]
