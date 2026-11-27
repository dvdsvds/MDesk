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