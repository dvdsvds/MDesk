import { foldable, foldedRanges, foldEffect, unfoldEffect } from '@codemirror/language'
import { EditorSelection, type EditorState, type Extension } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import chevronSvg from '../icons/chevron.svg?raw'
import { headingScaleOfText } from './markdownStyle'

class FoldChevron extends GutterMarker {
  constructor(
    readonly folded: boolean,
    readonly scale = 1
  ) {
    super()
  }
  eq(other: GutterMarker): boolean {
    return (
      other instanceof FoldChevron && other.folded === this.folded && other.scale === this.scale
    )
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = `cm-snote-chevron${this.folded ? ' folded' : ''}`
    // 제목 줄은 줄 높이가 커지므로 화살표 칸도 그만큼 키워 첫 줄 가운데에 맞춘다
    if (this.scale !== 1)
      el.style.height = `calc(var(--editor-font-size) * var(--editor-line-height) * ${this.scale})`
    el.innerHTML = chevronSvg
    return el
  }
}

const chevrons = new Map<string, FoldChevron>()
function chevron(folded: boolean, scale: number): FoldChevron {
  const key = `${folded}:${scale}`
  let c = chevrons.get(key)
  if (!c) chevrons.set(key, (c = new FoldChevron(folded, scale)))
  return c
}
const chevronOpen = chevron(false, 1)

function foldedAt(
  state: EditorState,
  from: number,
  to: number
): { from: number; to: number } | null {
  let found = null as { from: number; to: number } | null
  foldedRanges(state).between(from, to, (a, b) => {
    if (a >= from && a <= to) {
      found = { from: a, to: b }
      return false
    }
    return undefined
  })
  return found
}

/** 줄 높이가 한 줄의 1.5배 이상이면 줄바꿈으로 여러 줄이 된 줄이다 (레이아웃을 읽지 않고 줄 정보의 높이만 본다) */
function isWrapped(
  view: EditorView,
  line: { from: number; to: number; height: number },
  scale: number
): boolean {
  return line.to > line.from && line.height >= view.defaultLineHeight * scale * 1.5
}

/** 줄바꿈된 줄에서 첫 줄 끝부터 줄 끝까지를 접을 구간으로 돌려준다 (클릭할 때만 호출) */
function wrappedRange(
  view: EditorView,
  from: number,
  to: number
): { from: number; to: number } | null {
  const firstEnd = view.moveToLineBoundary(EditorSelection.cursor(from), true).head
  if (firstEnd <= from || firstEnd >= to) return null
  // 첫 줄이 가득 차 있으면 접힘 표시(…)가 다음 줄로 밀리므로, 첫 줄 끝 몇 글자도 같이 접는다
  return { from: Math.max(from + 1, firstEnd - 4), to }
}

const foldTheme = EditorView.theme({
  '.cm-gutters > .cm-gutter.cm-foldGutter': { display: 'none !important' },
  '.cm-snote-fold': { minWidth: '16px' },
  '.cm-snote-fold .cm-gutterElement': {
    padding: '0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  '.cm-snote-chevron': {
    display: 'flex',
    alignItems: 'center',
    height: 'calc(1em * var(--editor-line-height))',
    color: 'var(--color-text-tertiary)',
    opacity: '0.5',
    transition: 'opacity 0.12s'
  },
  '.cm-gutters:hover .cm-snote-chevron, .cm-snote-chevron.folded': { opacity: '1' },
  '.cm-snote-chevron:hover': { color: 'var(--color-text)' },
  '.cm-snote-chevron svg': { width: '12px', height: '12px', transform: 'rotate(90deg)' },
  '.cm-snote-chevron.folded svg': { transform: 'none' }
})

export function foldChevronGutter(): Extension {
  return [
    foldTheme,
    gutter({
      class: 'cm-snote-fold',
      lineMarker(view, line) {
        const scale = headingScaleOfText(
          view.state.doc.sliceString(line.from, Math.min(line.to, line.from + 8))
        )
        if (foldedAt(view.state, line.from, line.to)) return chevron(true, scale)
        if (foldable(view.state, line.from, line.to)) return chevron(false, scale)
        return isWrapped(view, { from: line.from, to: line.to, height: line.height }, scale)
          ? chevron(false, scale)
          : null
      },
      lineMarkerChange: (u) =>
        u.geometryChanged ||
        u.transactions.some((tr) => tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect))),
      initialSpacer: () => chevronOpen,
      domEventHandlers: {
        mousedown(view, line) {
          const folded = foldedAt(view.state, line.from, line.to)
          if (folded) {
            view.dispatch({ effects: unfoldEffect.of(folded) })
            return true
          }
          const range =
            foldable(view.state, line.from, line.to) ?? wrappedRange(view, line.from, line.to)
          if (range) view.dispatch({ effects: foldEffect.of(range) })
          return true
        }
      }
    })
  ]
}
