import type { Range as CmRange } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import katex from 'katex'
import type { SyntaxNode } from '@lezer/common'

const MATH_RE = /(?<![\\$])(\$\$?)(?![\s$])((?:\\.|[^$\\\n])+?)(?<!\s)\1(?![$\d])/g

class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly display: boolean
  ) {
    super()
  }
  eq(other: MathWidget): boolean {
    return other.tex === this.tex && other.display === this.display
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-math'
    el.style.cursor = 'text'
    el.innerHTML = katex.renderToString(this.tex, {
      displayMode: false,
      throwOnError: false,
      output: 'html',
      strict: 'ignore'
    })
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

const inCode = (view: EditorView, pos: number): boolean => {
  let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(pos, 1)
  for (; node; node = node.parent) if (/Code|Comment/.test(node.name)) return true
  return false
}

/** 커서가 없는 $수식$을 렌더링한 모양으로 바꿔 보여 준다 */
function build(view: EditorView): DecorationSet {
  const ranges: CmRange<Decoration>[] = []
  const sel = view.state.selection
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    MATH_RE.lastIndex = 0
    for (let m = MATH_RE.exec(text); m; m = MATH_RE.exec(text)) {
      const start = from + m.index
      const end = start + m[0].length
      if (sel.ranges.some((r) => r.from <= end && r.to >= start)) continue
      if (inCode(view, start)) continue
      ranges.push(
        Decoration.replace({ widget: new MathWidget(m[2], m[1] === '$$') }).range(start, end)
      )
    }
  }
  return Decoration.set(ranges, true)
}

export const mathPreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(u: ViewUpdate): void {
      if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged) {
        this.decorations = build(u.view)
      }
    }
  },
  { decorations: (v) => v.decorations }
)
