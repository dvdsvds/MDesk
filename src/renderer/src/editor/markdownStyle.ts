import { syntaxTree } from '@codemirror/language'
import { RangeSet, RangeSetBuilder, type EditorState, type Extension } from '@codemirror/state'
import {
  Decoration,
  GutterMarker,
  ViewPlugin,
  lineNumberMarkers,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'

/** 제목 단계별 글자 크기 배율. 미리보기(preview.css의 h1~h6)와 같게 맞춘다 */
export const HEADING_SCALE = [1.85, 1.45, 1.2, 1.05, 1, 1]

const ATX_RE = /^ {0,3}(#{1,6})(?:\s|$)/

/** 한 줄의 글이 `#`으로 시작하는 제목이면 그 줄의 글자 크기 배율, 아니면 1 */
export function headingScaleOfText(text: string): number {
  const m = ATX_RE.exec(text)
  return m ? HEADING_SCALE[m[1].length - 1] : 1
}

const lineDecos = HEADING_SCALE.map((_, i) => Decoration.line({ class: `cm-heading cm-h${i + 1}` }))
const inlineCodeDeco = Decoration.mark({ class: 'cm-inline-code' })

function headingLevel(name: string): number {
  const m = /^ATXHeading([1-6])$/.exec(name)
  return m ? Number(m[1]) : 0
}

function buildDecos(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>()
  let lastLine = -1
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const level = headingLevel(node.name)
        if (level) {
          const line = view.state.doc.lineAt(node.from)
          if (line.from > lastLine) {
            b.add(line.from, line.from, lineDecos[level - 1])
            lastLine = line.from
          }
        } else if (node.name === 'InlineCode' && node.to > node.from) {
          b.add(node.from, node.to, inlineCodeDeco)
        }
      }
    })
  }
  return b.finish()
}

const decorate = ViewPlugin.fromClass(
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

/** 제목 줄의 줄 번호 칸에 붙는 표시. 번호를 큰 글자 첫 줄 가운데에 맞추는 데 쓴다 */
class HeadingNumber extends GutterMarker {
  constructor(readonly level: number) {
    super()
    this.elementClass = `cm-gutter-h${level}`
  }
  eq(other: GutterMarker): boolean {
    return other instanceof HeadingNumber && other.level === this.level
  }
}

const numberMarks = HEADING_SCALE.map((_, i) => new HeadingNumber(i + 1))

function headingNumbers(state: EditorState): RangeSet<GutterMarker> {
  const b = new RangeSetBuilder<GutterMarker>()
  let lastLine = -1
  syntaxTree(state).iterate({
    enter: (node) => {
      const level = headingLevel(node.name)
      if (!level) return
      const line = state.doc.lineAt(node.from)
      if (line.from > lastLine) {
        b.add(line.from, line.from, numberMarks[level - 1])
        lastLine = line.from
      }
    }
  })
  return b.finish()
}

/** 마크다운 에디터 전용 글자 모양: 제목 크기(# 개수), 인라인 코드 테두리 */
export const markdownStyle: Extension = [
  decorate,
  lineNumberMarkers.compute(['doc'], headingNumbers)
]
