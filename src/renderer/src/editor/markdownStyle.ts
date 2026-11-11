import { syntaxTree } from '@codemirror/language'
import { Annotation, type Extension, type Range } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'

const inlineCodeDeco = Decoration.mark({ class: 'cm-inline-code' })
const emphasisTextDeco = Decoration.mark({ class: 'cm-em-text' })
const hrLineDeco = Decoration.line({ class: 'cm-hr-line' })

/** 글꼴이 바뀌었으니 글자 폭으로 정하는 장식(표 상자 폭)을 다시 만들라는 신호 */
export const refreshDecorations = Annotation.define<boolean>()

/** 표 줄 장식. 상자 폭은 표에서 가장 긴 줄의 글자 폭에 맞춘다(width는 px) */
function tableLineDeco(first: boolean, last: boolean, width: number): Decoration {
  const cls = `cm-table-line${first ? ' cm-table-first' : ''}${last ? ' cm-table-last' : ''}`
  return Decoration.line({ class: cls, attributes: { style: `width: ${width}px` } })
}

/** 에디터 글꼴로 글자 폭을 재는 함수 */
function makeMeasure(view: EditorView): (text: string) => number {
  const cs = getComputedStyle(view.contentDOM)
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return (t) => t.length * view.defaultCharacterWidth
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  return (t) => ctx.measureText(t).width
}

function buildDecos(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const doc = view.state.doc
  const measure = makeMeasure(view)
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === 'Table') {
          // 표는 줄마다 테두리를 이어 붙여 하나의 상자로 보이게 한다
          const first = doc.lineAt(node.from).number
          const last = doc.lineAt(node.to).number
          let widest = 0
          for (let n = first; n <= last; n++) widest = Math.max(widest, measure(doc.line(n).text))
          for (let n = first; n <= last; n++) {
            ranges.push(
              tableLineDeco(n === first, n === last, Math.ceil(widest)).range(doc.line(n).from)
            )
          }
          return
        }
        if (node.name === 'HorizontalRule') {
          // --- 줄은 커서가 없을 때 하얀 가로줄로 보인다(css)
          ranges.push(hrLineDeco.range(doc.lineAt(node.from).from))
          return
        }
        if (node.name === 'Emphasis') {
          // *글자* 는 기호를 빼고 안쪽 글자만 기울인다
          const marks = node.node.getChildren('EmphasisMark')
          if (marks.length >= 2 && marks[marks.length - 1].from > marks[0].to) {
            ranges.push(emphasisTextDeco.range(marks[0].to, marks[marks.length - 1].from))
          }
          // 안쪽의 인라인 코드 등도 계속 처리한다
          return
        }
        if (node.name !== 'InlineCode') return
        // 배경·테두리는 앞뒤 백틱을 뺀 안쪽 글자에만 입힌다
        const marks = node.node.getChildren('CodeMark')
        if (marks.length < 2) return
        const inner = { from: marks[0].to, to: marks[marks.length - 1].from }
        if (inner.to > inner.from) ranges.push(inlineCodeDeco.range(inner.from, inner.to))
      }
    })
  }
  return Decoration.set(ranges, true)
}

/** 마크다운 에디터 전용 글자 모양: 인라인 코드 안쪽 글자의 배경과 테두리, 표 줄의 상자 */
export const markdownStyle: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    private readonly onFontsLoaded: () => void
    constructor(view: EditorView) {
      this.decorations = buildDecos(view)
      // 글꼴 파일이 늦게 불러와지면 글자 폭이 달라지므로 그때도 다시 만든다
      this.onFontsLoaded = (): void => view.dispatch({ annotations: refreshDecorations.of(true) })
      document.fonts?.addEventListener('loadingdone', this.onFontsLoaded)
    }
    destroy(): void {
      document.fonts?.removeEventListener('loadingdone', this.onFontsLoaded)
    }
    update(u: ViewUpdate): void {
      // 글꼴이 바뀌거나 늦게 불러와져 글자 폭이 달라지면(geometryChanged) 표 상자 폭도 다시 잰다
      if (
        u.docChanged ||
        u.viewportChanged ||
        u.geometryChanged ||
        u.transactions.some((tr) => tr.annotation(refreshDecorations)) ||
        syntaxTree(u.startState) !== syntaxTree(u.state)
      ) {
        this.decorations = buildDecos(u.view)
      }
    }
  },
  { decorations: (v) => v.decorations }
)
