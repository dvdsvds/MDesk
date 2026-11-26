import { EditorSelection, type StateCommand } from '@codemirror/state'
import { insertNewlineContinueMarkupCommand } from '@codemirror/lang-markdown'

const base = insertNewlineContinueMarkupCommand({ nonTightLists: false })

/** 줄바꿈 + 빈 줄(공백이나 `>`만 있는 줄) + 줄바꿈으로 시작하는 삽입 */
const BLANK_LEAD = /^\n[ \t>]*\n/

/**
 * 목록·인용에서 Enter를 치면 다음 줄에 기호를 이어 붙인다.
 * 기본 명령은 목록의 첫 두 항목 사이에 빈 줄이 있으면(`- a`, 빈 줄, `- 내용`) 느슨한 목록으로 보고
 * 새 항목 앞에 빈 줄을 하나 더 넣는데, 그 빈 줄은 빼고 바로 다음 줄에 기호를 붙인다
 */
export const continueListMarkup: StateCommand = ({ state, dispatch }) =>
  base({
    state,
    dispatch: (tr) => {
      const changes: { from: number; to: number; insert: string }[] = []
      // 새 문서 기준으로 빈 줄을 뺀 자리와 뺀 길이
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
