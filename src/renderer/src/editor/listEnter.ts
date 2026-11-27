import { EditorSelection, type StateCommand } from '@codemirror/state'
import { insertNewlineContinueMarkupCommand } from '@codemirror/lang-markdown'

const base = insertNewlineContinueMarkupCommand({ nonTightLists: false })

const BLANK_LEAD = /^\n[ \t>]*\n/

/** 목록·인용에서 Enter를 치면 다음 줄에 기호를 이어 붙인다. */
export const continueListMarkup: StateCommand = ({ state, dispatch }) =>
  base({
    state,
    dispatch: (tr) => {
      const changes: { from: number; to: number; insert: string }[] = []
      const removed: { at: number; len: number }[] = []
      tr.changes.iterChanges((fromA, toA, fromB, _toB, inserted) => {
        let insert = inserted.toString()
        const m = BLANK_LEAD.exec(insert)
        if (m) {
          const len = m[0].length - 1
          insert = insert.slice(len)
          removed.push({ at: fromB, len })
        }
        changes.push({ from: fromA, to: toA, insert })
      })
      if (removed.length === 0) return dispatch(tr)
      const shift = (pos: number): number =>
        pos - removed.reduce((sum, r) => (r.at < pos ? sum + Math.min(r.len, pos - r.at) : sum), 0)
      dispatch(
        state.update({
          changes,
          selection: EditorSelection.create(
            tr.newSelection.ranges.map((r) =>
              EditorSelection.range(shift(r.anchor), shift(r.head))
            ),
            tr.newSelection.mainIndex
          ),
          scrollIntoView: true,
          userEvent: 'input'
        })
      )
    }
  })
