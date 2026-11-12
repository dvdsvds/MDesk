import type MarkdownIt from 'markdown-it'
import type { StateBlock } from 'markdown-it'

type MD = InstanceType<typeof MarkdownIt>

/** `[>] 제목` 한 줄. 제목이 없으면 아코디언으로 보지 않는다 */
const HEAD_RE = /^\[>\][ \t]+(\S.*)$/

/**
 * 아코디언: `[>] 제목` 줄과 그 아래 들여쓴 줄들을 접히는 상자로 바꾼다. 항상 접힌 채로 시작한다.
 *
 *     [>] 제목
 *         들여쓴 내용(여러 줄, 목록, 코드, 다른 아코디언도 가능)
 *
 * 들여쓴 줄이 하나도 없으면 아코디언이 아니라 그냥 글자로 둔다.
 * 내용은 첫 들여쓴 줄의 들여쓰기를 기준으로 다시 해석하므로 리스트처럼 중첩할 수 있다.
 */
export function accordionPlugin(md: MD): void {
  md.block.ruler.before(
    'reference',
    'accordion',
    (state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false
      const start = state.bMarks[startLine] + state.tShift[startLine]
      const head = HEAD_RE.exec(state.src.slice(start, state.eMarks[startLine]))
      if (!head) return false

      const headIndent = state.sCount[startLine]
      let bodyIndent = -1
      let last = startLine
      for (let line = startLine + 1; line < endLine; line++) {
        if (state.isEmpty(line)) continue
        const indent = state.sCount[line]
        if (indent <= headIndent) break
        if (bodyIndent === -1) bodyIndent = indent
        else if (indent < bodyIndent) break
        last = line
      }
      if (bodyIndent === -1) return false
      if (silent) return true

      const open = state.push('accordion_open', 'details', 1)
      open.block = true
      open.markup = '[>]'
      open.map = [startLine, last + 1]
      open.attrSet('class', 'accordion')

      const summaryOpen = state.push('accordion_summary_open', 'summary', 1)
      summaryOpen.block = true
      const title = state.push('inline', '', 0)
      title.content = head[1].trim()
      title.map = [startLine, startLine + 1]
      title.children = []
      state.push('accordion_summary_close', 'summary', -1).block = true

      const bodyOpen = state.push('accordion_body_open', 'div', 1)
      bodyOpen.block = true
      bodyOpen.attrSet('class', 'accordion-body')

      const oldParent = state.parentType
      const oldBlkIndent = state.blkIndent
      state.parentType = 'blockquote'
      state.blkIndent = bodyIndent
      state.md.block.tokenize(state, startLine + 1, last + 1)
      state.blkIndent = oldBlkIndent
      state.parentType = oldParent

      state.push('accordion_body_close', 'div', -1).block = true
      state.push('accordion_close', 'details', -1).block = true
      state.line = last + 1
      return true
    },
    { alt: ['paragraph'] }
  )
}
