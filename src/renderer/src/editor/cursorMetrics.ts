import type { Extension } from '@codemirror/state'
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view'

export function cursorMetrics(): Extension {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.sync(view)
      }
      update(u: ViewUpdate): void {
        this.sync(u.view)
      }
      sync(view: EditorView): void {
        view.requestMeasure({
          read: () => {
            const sy = parseFloat(getComputedStyle(document.body).zoom) || 1
            const head = view.state.selection.main.head
            const c = view.coordsAtPos(head)
            const node = view.domAtPos(head).node
            const el = (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest(
              '.cm-line'
            )
            // 제목 줄은 글자가 커서 줄 높이가 다르다. 커서가 있는 줄의 실제 줄 높이를 쓴다
            const elH = el ? parseFloat(getComputedStyle(el).lineHeight) : NaN
            const lineHs = Number.isFinite(elH) ? elH * sy : view.defaultLineHeight
            const lineH = lineHs / sy
            let topS = 0
            let chS = lineHs
            if (c && el) {
              const lr = el.getBoundingClientRect()
              // 글자 상자는 줄 칸보다 크거나 작을 수 있어 줄 윗면과의 차이가 음수일 수 있다.
              // 나머지(%)로 구하면 음수가 줄 높이에 가깝게 바뀌어 커서가 한 줄 위로 올라가므로
              // 가장 가까운 줄 윗면을 기준으로 부호 있는 차이를 쓴다
              const row = Math.round((c.top - lr.top) / lineHs)
              topS = c.top - (lr.top + row * lineHs)
              chS = c.bottom - c.top
            }
            return { lineHs, lineH, topS, chS, sy }
          },
          write: ({ lineHs, lineH, topS, chS, sy }) => {
            const s = view.dom.style
            s.setProperty('--cm-line-hs', `${lineHs}px`)
            s.setProperty('--cm-cur-tops', `${topS}px`)
            s.setProperty('--cm-line-h', `${lineH}px`)
            s.setProperty('--cm-cur-top', `${topS / sy}px`)
            s.setProperty('--cm-cur-h', `${chS / sy}px`)
          }
        })
      }
    }
  )
}
