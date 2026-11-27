import MarkdownIt from 'markdown-it'
import type { StateCore, Token } from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'
import { mathPlugin } from './mathPlugin'
import { sanitizeGithubHtml } from './githubSanitize'

type MD = InstanceType<typeof MarkdownIt>

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i
const ALERT_TITLE: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution'
}

interface GithubEnv {
  nonce: string
  math: string[]
}

/** `> [!NOTE]`로 시작하는 인용문을 GitHub 알림 상자로 바꿈 */
function alertRule(state: StateCore): boolean {
  const tokens = state.tokens
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i]
    if (open.type !== 'blockquote_open') continue
    const inline = tokens[i + 2]
    if (tokens[i + 1]?.type !== 'paragraph_open' || inline?.type !== 'inline') continue
    const m = ALERT_RE.exec(inline.content)
    if (!m) continue
    let depth = 0
    let close = -1
    for (let j = i; j < tokens.length; j++) {
      if (tokens[j].type === 'blockquote_open') depth++
      if (tokens[j].type === 'blockquote_close' && --depth === 0) {
        close = j
        break
      }
    }
    if (close === -1) continue
    const kind = m[1].toLowerCase()
    open.tag = 'div'
    open.attrSet('class', `markdown-alert markdown-alert-${kind}`)
    tokens[close].tag = 'div'
    const title = new state.Token('html_block', '', 0)
    title.content = `<p class="markdown-alert-title">${ALERT_TITLE[kind]}</p>\n`
    const rest = inline.content.slice(m[0].length)
    if (rest.trim()) {
      inline.content = rest
      inline.children = []
      state.md.inline.parse(rest, state.md, state.env, inline.children)
      tokens.splice(i + 1, 0, title)
    } else {
      tokens.splice(i + 1, 3, title)
    }
  }
  return true
}

/** 수식은 정리 뒤에 넣도록 자리표시로 렌더링 */
function mathPlaceholders(md: MD): void {
  for (const name of ['math_inline', 'math_block'] as const) {
    const original = md.renderer.rules[name]
    if (!original) continue
    const tag = name === 'math_inline' ? 'span' : 'div'
    md.renderer.rules[name] = (tokens, idx, options, env, self) => {
      const e = env as unknown as GithubEnv
      e.math.push(original(tokens, idx, options, env, self))
      return `<${tag} data-gh-math="${e.nonce}-${e.math.length - 1}"></${tag}>`
    }
  }
}

/** 줄 번호 속성을 붙여 스크롤 맞춤에 쓰게 함 */
function lineAttrs(md: MD): void {
  md.core.ruler.push('gh-lines', (state) => {
    for (const token of state.tokens as Token[]) {
      if (!token.map) continue
      if (
        token.type === 'list_item_open' &&
        String(token.attrGet('class') ?? '').includes('task-list-item')
      )
        token.attrSet('data-line', String(token.map[0]))
      if (token.level !== 0) continue
      if (token.type === 'fence') {
        token.attrSet('data-line', String(token.map[0]))
        token.attrSet('data-end', String(token.map[1]))
      }
      if (token.type === 'heading_open') token.attrSet('data-line', String(token.map[0]))
    }
    return true
  })
}

function createGithubMarkdownIt(): MD {
  const md = new MarkdownIt({ html: true, linkify: true, breaks: false, typographer: false })
  md.use(taskLists, { enabled: true, label: true })
  md.use(footnote)
  md.use(mathPlugin)
  mathPlaceholders(md)
  md.core.ruler.after('inline', 'gh-alert', alertRule)
  lineAttrs(md)
  return md
}

const md = createGithubMarkdownIt()

/** 렌더링마다 바뀌는 임의 값 */
function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** GitHub 파일을 GitHub 규칙으로 렌더링하고 정리 */
export function renderGithubMarkdown(source: string): string {
  const env: GithubEnv = { nonce: makeNonce(), math: [] }
  const clean = sanitizeGithubHtml(md.render(source, env as unknown as Record<string, unknown>))
  if (env.math.length === 0) return clean
  const re = new RegExp(`<(span|div) data-gh-math="${env.nonce}-(\\d+)"></\\1>`, 'g')
  return clean.replace(re, (_m, _tag, i: string) => env.math[Number(i)] ?? '')
}
