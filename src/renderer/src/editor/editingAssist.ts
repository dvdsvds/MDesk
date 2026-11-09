import { syntaxTree } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

const AUTO_PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const CLOSERS = new Set(Object.values(AUTO_PAIRS))
const WRAP_ONLY: Record<string, string> = {
  '"': '"',
  '`': '`',
  "'": "'",
  _: '_',
  '*': '*',
  '~': '~'
}
const DOUBLING = new Set(['*', '~'])

/** 백틱을 칠 때 짝을 자동으로 닫을지: 이미 닫는 백틱 앞이면 건너뛰고, 코드 블록 안이나 ``` 입력 중이면 그냥 입력 */
function backtickAction(view: EditorView, pos: number): 'skip' | 'pair' | 'plain' {
  const state = view.state
  const next = state.sliceDoc(pos, pos + 1)
  const prev = state.sliceDoc(pos - 1, pos)
  if (next === '`') return 'skip'
  if (prev === '`') return 'plain'
  for (let n = syntaxTree(state).resolveInner(pos, -1); n.parent; n = n.parent) {
    if (n.name === 'FencedCode' || n.name === 'CodeBlock') return 'plain'
  }
  return next === '' || /[\s)\]}.,;:!?]/.test(next) ? 'pair' : 'plain'
}

export function editingAssist(): Extension {
  return EditorView.inputHandler.of((view, from, to, insertedText) => {
    const hasSelection = from !== to
    const state = view.state

    if (insertedText === '`' && !hasSelection) {
      const action = backtickAction(view, from)
      if (action === 'skip') {
        view.dispatch({ selection: { anchor: from + 1 } })
        return true
      }
      if (action === 'pair') {
        view.dispatch({ changes: { from, insert: '``' }, selection: { anchor: from + 1 } })
        return true
      }
    }

    if (Object.prototype.hasOwnProperty.call(AUTO_PAIRS, insertedText)) {
      const close = AUTO_PAIRS[insertedText]
      const selectedText = hasSelection ? state.sliceDoc(from, to) : ''
      view.dispatch({
        changes: { from, to, insert: insertedText + selectedText + close },
        selection: { anchor: from + 1, head: from + 1 + selectedText.length }
      })
      return true
    }

    if (CLOSERS.has(insertedText) && !hasSelection && state.sliceDoc(to, to + 1) === insertedText) {
      view.dispatch({ selection: { anchor: to + 1 } })
      return true
    }

    if (
      !hasSelection &&
      DOUBLING.has(insertedText) &&
      state.sliceDoc(from - 1, from) === insertedText
    ) {
      view.dispatch({
        changes: { from, insert: insertedText + insertedText + insertedText },
        selection: { anchor: from + 1 }
      })
      return true
    }

    if (Object.prototype.hasOwnProperty.call(WRAP_ONLY, insertedText)) {
      if (hasSelection) {
        const selectedText = state.sliceDoc(from, to)
        const wrap = WRAP_ONLY[insertedText]
        view.dispatch({
          changes: { from, to, insert: insertedText + selectedText + wrap },
          selection: { anchor: from + 1, head: from + 1 + selectedText.length }
        })
      } else {
        view.dispatch({
          changes: { from, to, insert: insertedText },
          selection: { anchor: from + insertedText.length }
        })
      }
      return true
    }

    return false
  })
}
