import { EditorState, type Extension, type Text } from '@codemirror/state'

const ITEM_RE = /^(\s*)(\d+)([.)])\s/

interface Change {
  from: number
  to: number
  insert: string
}

/** lineNo 줄이 들어 있는 같은 들여쓰기의 번호 목록을 위에서부터 차례로 다시 매기는 변경 목록. */
function renumberGroup(doc: Text, lineNo: number, baseOverride: number | null): Change[] {
  const line = doc.line(lineNo)
  const match = line.text.match(ITEM_RE)
  if (!match) return []
  const indent = match[1]

  let startLine = lineNo
  while (startLine > 1) {
    const m = doc.line(startLine - 1).text.match(ITEM_RE)
    if (!m || m[1] !== indent) break
    startLine--
  }
  let endLine = lineNo
  while (endLine < doc.lines) {
    const m = doc.line(endLine + 1).text.match(ITEM_RE)
    if (!m || m[1] !== indent) break
    endLine++
  }

  const first = doc.line(startLine).text.match(ITEM_RE)
  if (!first) return []
  let expected = baseOverride ?? parseInt(first[2], 10)
  const changes: Change[] = []
  for (let n = startLine; n <= endLine; n++) {
    const l = doc.line(n)
    const m = l.text.match(ITEM_RE)
    if (!m) continue
    const numStr = String(expected)
    if (m[2] !== numStr) {
      const from = l.from + m[1].length
      changes.push({ from, to: from + m[2].length, insert: numStr })
    }
    expected++
  }
  return changes
}

/** 번호 목록의 항목 줄을 지우면(줄바꿈이 함께 지워지면) 남은 항목의 번호를 다시 매긴다. */
export function listRenumber(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || tr.isUserEvent('undo') || tr.isUserEvent('redo')) return tr
    if (tr.isUserEvent('input.paste') || tr.isUserEvent('input.table')) return tr

    const oldDoc = tr.startState.doc
    const doc = tr.newDoc
    const spots: { pos: number; wasFirst: boolean }[] = []
    tr.changes.iterChanges((fromA, toA, fromB) => {
      if (fromA === toA || !oldDoc.sliceString(fromA, toA).includes('\n')) return
      let wasFirst = false
      const firstLine = oldDoc.lineAt(fromA).number
      const lastLine = oldDoc.lineAt(toA).number
      for (let n = firstLine; n <= lastLine; n++) {
        const m = oldDoc.line(n).text.match(ITEM_RE)
        if (m) {
          wasFirst = parseInt(m[2], 10) === 1
          break
        }
      }
      spots.push({ pos: Math.min(fromB, doc.length), wasFirst })
    })
    if (spots.length === 0) return tr

    const seen = new Set<number>()
    const edits: Change[] = []
    for (const { pos, wasFirst } of spots) {
      const at = doc.lineAt(pos).number
      for (const n of [at, at + 1, at - 1]) {
        if (n < 1 || n > doc.lines) continue
        if (!ITEM_RE.test(doc.line(n).text)) continue
        const m = doc.line(n).text.match(ITEM_RE)
        if (!m) continue
        let top = n
        while (top > 1) {
          const p = doc.line(top - 1).text.match(ITEM_RE)
          if (!p || p[1] !== m[1]) break
          top--
        }
        const topKey = doc.line(top).from
        if (seen.has(topKey)) continue
        seen.add(topKey)
        const base = wasFirst && top >= at && top <= at + 1 ? 1 : null
        edits.push(...renumberGroup(doc, n, base))
        break
      }
    }
    if (edits.length === 0) return tr
    return [tr, { changes: edits, sequential: true }]
  })
}
