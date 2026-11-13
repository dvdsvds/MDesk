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
            const lineHs = view.defaultLineHeight
            const lineH = lineHs / sy
            const head = view.state.selection.main.head
            let c = view.coordsAtPos(head)
            // 줄 끝에 크기 0짜리 위젯(코드 블록 복사 버튼)이 있으면 그 위젯의 좌표가 나와 커서가 줄 아래로 밀린다.
            // 높이가 거의 없으면 앞 글자 쪽 좌표를 쓴다
            if (!c || c.bottom - c.top < 2) {
              const prev = view.coordsAtPos(head, -1)
              if (prev && prev.bottom - prev.top >= 2) c = prev
            }
            const node = view.domAtPos(head).node
            const el = (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest(
              '.cm-line'
            )
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