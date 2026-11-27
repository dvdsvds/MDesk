import DOMPurify, { type Config } from 'dompurify'

const purify = DOMPurify(window)

const TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'div',
  'span',
  'br',
  'hr',
  'b',
  'i',
  'strong',
  'em',
  'u',
  's',
  'strike',
  'del',
  'ins',
  'mark',
  'sub',
  'sup',
  'small',
  'kbd',
  'code',
  'pre',
  'samp',
  'var',
  'tt',
  'abbr',
  'q',
  'cite',
  'blockquote',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  'details',
  'summary',
  'ruby',
  'rt',
  'rp',
  'figure',
  'figcaption',
  'picture',
  'section',
  'a',
  'img',
  'input',
  'label'
]

const ATTRS = [
  'href',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'align',
  'valign',
  'colspan',
  'rowspan',
  'open',
  'start',
  'reversed',
  'lang',
  'dir',
  'type',
  'checked',
  'disabled',
  'class',
  'id',
  'data-line',
  'data-end',
  'data-gh-math'
]

const CLASS_RE =
  /^(?:task-list-item(?:-checkbox|-label)?|contains-task-list|footnotes?(?:-sep|-list)?|footnote-(?:ref|item|backref)|markdown-alert(?:-title|-note|-tip|-important|-warning|-caution)?|language-[\w+#-]+)$/
const ID_RE = /^fn(?:ref)?\d+(?::\d+)?$/
const URI_RE = /^(?:(?:https?|mailto):|[^a-z]|[a-z0-9+.-]+(?:[^a-z0-9+.\-:]|$))/i

const CONFIG: Config = {
  ALLOWED_TAGS: TAGS,
  ALLOWED_ATTR: ATTRS,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOWED_URI_REGEXP: URI_RE,
  ADD_DATA_URI_TAGS: []
}

purify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'input') return
  const el = node as Element
  const ok =
    el.getAttribute('type') === 'checkbox' && el.classList.contains('task-list-item-checkbox')
  if (!ok) el.remove()
})

purify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'class') {
    const kept = data.attrValue.split(/\s+/).filter((c) => CLASS_RE.test(c))
    if (kept.length) data.attrValue = kept.join(' ')
    else data.keepAttr = false
  } else if (data.attrName === 'id') {
    if (!ID_RE.test(data.attrValue)) data.keepAttr = false
  }
})

purify.addHook('afterSanitizeAttributes', (node) => {
  const el = node as Element
  if (el.tagName === 'A' && el.hasAttribute('href')) el.setAttribute('rel', 'noopener noreferrer')
  if (el.tagName !== 'IMG') return
  const src = (el.getAttribute('src') ?? '').trim()
  el.removeAttribute('src')
  if (/^https?:\/\//i.test(src)) el.setAttribute('data-gh-remote', src)
  else if (src && !/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith('//'))
    el.setAttribute('data-gh-rel', src)
})

/** GitHub 파일 미리보기 HTML을 GitHub 기준 허용 목록으로 정리 */
export function sanitizeGithubHtml(html: string): string {
  return purify.sanitize(html, CONFIG) as string
}
