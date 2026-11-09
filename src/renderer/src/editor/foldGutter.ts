import { foldable, foldedRanges, foldEffect, unfoldEffect } from '@codemirror/language'
import { EditorSelection, type EditorState, type Extension } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import chevronSvg from '../icons/chevron.svg?raw'

class FoldChevron extends GutterMarker {
  constructor(readonly folded: boolean) {
    super()
  }
  eq(other: GutterMarker): boolean {
    return other instanceof FoldChevron && other.folded === this.folded
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = `cm-snote-chevron${this.folded ? ' folded' : ''}`
    el.innerHTML = chevronSvg
    return el
  }
}

const chevronOpen = new FoldChevron(false)
const chevronFolded = new FoldChevron(true)

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
function isWrapped(view: EditorView, line: { from: number; to: number; height: number }): boolean {
  return line.to > line.from && line.height >= view.defaultLineHeight * 1.5
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
        if (foldedAt(view.state, line.from, line.to)) return chevronFolded
        if (foldable(view.state, line.from, line.to)) return chevronOpen
        return isWrapped(view, { from: line.from, to: line.to, height: line.height })
          ? chevronOpen
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
