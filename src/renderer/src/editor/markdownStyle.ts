import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'

const inlineCodeDeco = Decoration.mark({ class: 'cm-inline-code' })

function buildDecos(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'InlineCode') return
        // 배경·테두리는 앞뒤 백틱을 뺀 안쪽 글자에만 입힌다
        const marks = node.node.getChildren('CodeMark')
        if (marks.length < 2) return
        const inner = { from: marks[0].to, to: marks[marks.length - 1].from }
        if (inner.to > inner.from) b.add(inner.from, inner.to, inlineCodeDeco)
      }
    })
  }
  return b.finish()
}

/** 마크다운 에디터 전용 글자 모양: 인라인 코드 안쪽 글자의 배경과 테두리 */
export const markdownStyle: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecos(view)
    }
    update(u: ViewUpdate): void {
      if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
        this.decorations = buildDecos(u.view)
      }
    }
  },
  { decorations: (v) => v.decorations }
)
