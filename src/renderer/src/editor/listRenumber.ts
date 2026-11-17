import { EditorState, type Extension, type Text } from '@codemirror/state'

const ITEM_RE = /^(\s*)(\d+)([.)])\s/

interface Change {
  from: number
  to: number
  insert: string
}

/**
 * lineNo 줄이 들어 있는 같은 들여쓰기의 번호 목록을 위에서부터 차례로 다시 매기는 변경 목록.
 * 첫 항목의 번호가 기준이다. baseOverride가 있으면 첫 항목을 그 번호로 바꾼다
 */
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

/**
 * 번호 목록의 항목 줄을 지우면(줄바꿈이 함께 지워지면) 남은 항목의 번호를 다시 매긴다.
 * 1 2 3 4에서 2를 지우면 1 3 4가 아니라 1 2 3이 된다. 첫 항목(1)을 지웠을 때도 남은 목록이 1부터 시작한다.
 * Ctrl+Z로 되돌리는 변경이나 붙여넣기는 건드리지 않는다. 미리보기는 번호를 알아서 순서대로 매기므로 원문만 고치면 된다
 */
export function listRenumber(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || tr.isUserEvent('undo') || tr.isUserEvent('redo')) return tr
    if (tr.isUserEvent('input.paste') || tr.isUserEvent('input.table')) return tr

    const oldDoc = tr.startState.doc
    const doc = tr.newDoc
    // 줄바꿈이 지워진 자리(새 문서 기준)와, 그 자리에 있던 옛 줄이 1번 항목이었는지
    const spots: { pos: number; wasFirst: boolean }[] = []
    tr.changes.iterChanges((fromA, toA, fromB) => {
      if (fromA === toA || !oldDoc.sliceString(fromA, toA).includes('\n')) return
      // 지운 구간 안의 번호 줄 중 가장 앞의 번호
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
      // 지운 자리의 줄과 그 바로 아래·위 줄에서 번호 목록을 찾는다
      for (const n of [at, at + 1, at - 1]) {
        if (n < 1 || n > doc.lines) continue
        if (!ITEM_RE.test(doc.line(n).text)) continue
        const m = doc.line(n).text.match(ITEM_RE)
        if (!m) continue
        // 같은 목록은 한 번만 다룬다 (목록 맨 위 줄의 위치를 키로 쓴다)
        let top = n
        while (top > 1) {
          const p = doc.line(top - 1).text.match(ITEM_RE)
          if (!p || p[1] !== m[1]) break
          top--
        }
        const topKey = doc.line(top).from
        if (seen.has(topKey)) continue
        seen.add(topKey)
        // 지운 자리가 목록의 맨 앞이고 지운 것이 1번이었으면 남은 목록을 1부터 다시 시작한다
        const base = wasFirst && top >= at && top <= at + 1 ? 1 : null
        edits.push(...renumberGroup(doc, n, base))
        break
      }
    }
    if (edits.length === 0) return tr
    return [tr, { changes: edits, sequential: true }]
  })
}
