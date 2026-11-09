import { EditorSelection } from '@codemirror/state'
import { layer, RectangleMarker, type EditorView } from '@codemirror/view'
import { visualChar } from './selectionPerLine'

const CLS = 'cm-fullSel'

function markers(view: EditorView): RectangleMarker[] {
  const out: RectangleMarker[] = []
  const lh = view.defaultLineHeight
  // vim visual(글자) 모드는 vim이 가진 선택 구간으로 칠한다(문서 선택과 한 칸 어긋나기 때문)
  const vis = visualChar(view)
  const ranges = vis
    ? vis.segs.map((g) => EditorSelection.range(g.from, g.to))
    : view.state.selection.ranges
  for (const r of ranges) {
    if (r.empty) continue
    const probe = view.coordsAtPos(r.from, 1) ?? view.coordsAtPos(r.from, -1)
    const glyph = probe ? probe.bottom - probe.top : lh
    const pad = Math.max(0, (lh - glyph) / 2)
    for (const m of RectangleMarker.forRange(view, CLS, r)) {
      const between = Math.abs(m.height - glyph) > 1
      const top = between ? m.top + pad : m.top - pad
      const height = between ? m.height - pad * 2 : m.height + pad * 2
      if (height <= 0.5) continue
      out.push(new RectangleMarker(CLS, m.left, top, m.width, height))
    }
  }
  return out
}

export const fullLineSelection = layer({
  above: false,
  class: 'cm-fullSelLayer',
  update: (u) => u.selectionSet || u.docChanged || u.viewportChanged || u.geometryChanged,
  markers
})