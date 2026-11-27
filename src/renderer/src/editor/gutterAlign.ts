import type { Extension } from '@codemirror/state'
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view'

let canvas: HTMLCanvasElement | null = null

/** 줄 칸 맨 위에서 숫자 '0'의 세로 가운데까지 거리(px) */
function digitCenter(style: CSSStyleDeclaration, lineHeight: number): number | null {
  canvas ??= document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const m = ctx.measureText('0')
  const ascent = m.fontBoundingBoxAscent
  const descent = m.fontBoundingBoxDescent
  const baseline = (lineHeight - (ascent + descent)) / 2 + ascent
  return baseline - m.actualBoundingBoxAscent / 2
}

/** 줄 번호는 UI 글꼴, 본문은 에디터 글꼴이라 같은 줄 칸 안에서 숫자가 놓이는 높이가 다르다. */
export function gutterAlign(): Extension {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.sync(view)
      }
      update(u: ViewUpdate): void {
        if (u.geometryChanged || u.viewportChanged) this.sync(u.view)
      }
      sync(view: EditorView): void {
        view.requestMeasure({
          read: () => {
            const line = view.contentDOM.querySelector('.cm-line')
            const num = view.dom.querySelector('.cm-lineNumbers .cm-gutterElement')
            if (!line || !num) return null
            const lineHeight = view.defaultLineHeight
            const content = digitCenter(getComputedStyle(line), lineHeight)
            const gutter = digitCenter(getComputedStyle(num), lineHeight)
            if (content === null || gutter === null) return null
            return Math.round(content - gutter)
          },
          write: (shift) => {
            if (shift === null) return
            view.dom.style.setProperty('--cm-gutter-shift', `${shift}px`)
          }
        })
      }
    }
  )
}
