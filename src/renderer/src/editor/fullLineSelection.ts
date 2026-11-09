import { EditorSelection } from '@codemirror/state'
import { layer, RectangleMarker, type EditorView } from '@codemirror/view'
import { headingScaleOfText } from './markdownStyle'
import { visualChar } from './selectionPerLine'

const CLS = 'cm-fullSel'

function markers(view: EditorView): RectangleMarker[] {
  const out: RectangleMarker[] = []
  const lh = view.defaultLineHeight
  const doc = view.state.doc
  const scrollRect = view.scrollDOM.getBoundingClientRect()
  const baseTop = scrollRect.top - view.scrollDOM.scrollTop
  // vim visual(글자) 모드는 vim이 가진 선택 구간으로 칠한다(문서 선택과 한 칸 어긋나기 때문)
  const vis = visualChar(view)
  const ranges = vis
    ? vis.segs.map((g) => EditorSelection.range(g.from, g.to))
    : view.state.selection.ranges
  for (const r of ranges) {
    if (r.empty) continue
    const probe = view.coordsAtPos(r.from, 1) ?? view.coordsAtPos(r.from, -1)
    // 제목 줄은 글자·줄 높이가 배율만큼 커진다. 배율 1 기준의 글자 상자 높이를 구해 두고 줄마다 곱한다
    const probeScale = headingScaleOfText(doc.lineAt(r.from).text)
    const glyph1 = (probe ? probe.bottom - probe.top : lh) / probeScale
    for (const m of RectangleMarker.forRange(view, CLS, r)) {
      const docY = m.top + m.height / 2 + baseTop - view.documentTop
      const block = view.lineBlockAtHeight(docY)
      const scale = headingScaleOfText(doc.lineAt(block.from).text)
      const glyph = glyph1 * scale
      const pad = Math.max(0, (lh * scale - glyph) / 2)
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
