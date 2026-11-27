export interface MarkdownRenderer {
  render(source: string, baseDir?: string): string
}

import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'
import { sanitizeHtml } from './sanitize'
import { wikilinkPlugin } from './wikilinkPlugin'
import { calloutPlugin } from './calloutPlugin'
import { accordionPlugin } from './accordionPlugin'
import { embedPlugin } from './embedPlugin'
import { blockPlugin } from './blockPlugin'
import { colorSpanPlugin } from './colorSpanPlugin'
import { templatePlugin } from '../features/template/parse/templatePlugin'
import { mathPlugin } from './mathPlugin'
import { remoteImagePlugin } from './remoteImagePlugin'
import { snoteUrl } from '@renderer/utils/snoteUrl'

function createMarkdownIt(): InstanceType<typeof MarkdownIt> {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    typographer: false
  })

  md.block.ruler.disable('lheading')
  md.use(taskLists, { enabled: true, label: true })
  md.core.ruler.after('github-task-lists', 'task-list-line', (state) => {
    for (const token of state.tokens) {
      if (
        token.type === 'list_item_open' &&
        token.map &&
        String(token.attrGet('class') ?? '').includes('task-list-item')
      ) {
        token.attrSet('data-line', String(token.map[0]))
      }
    }
    return true
  })
  md.use(footnote)
  md.use(embedPlugin)
  md.use(wikilinkPlugin)
  md.use(calloutPlugin)
  md.use(accordionPlugin)
  md.use(blockPlugin)
  md.use(templatePlugin)
  md.use(mathPlugin)
  md.use(colorSpanPlugin)
  md.use(remoteImagePlugin)
  md.core.ruler.push('fence-lines', (state) => {
    for (const token of state.tokens) {
      if (token.type === 'fence' && token.level === 0 && token.map) {
        token.attrSet('data-line', String(token.map[0]))
        token.attrSet('data-end', String(token.map[1]))
      }
      if (token.type === 'heading_open' && token.level === 0 && token.map) {
        token.attrSet('data-line', String(token.map[0]))
      }
    }
    return true
  })
  return md
}

const md = createMarkdownIt()

/** 마크다운이 링크 주소를 정규화한 결과 */
export function normalizeMarkdownLink(url: string): string {
  return md.normalizeLink(url)
}

function resolveAttachmentSrcs(html: string, baseDir: string): string {
  return html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/g, (match, prefix, src, suffix) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('/')) return match
    let path = src.replace(/&amp;/g, '&')
    try {
      path = decodeURIComponent(path)
    } catch {}
    return `${prefix}${snoteUrl(`${baseDir.replace(/\\/g, '/')}/${path}`)}${suffix}`
  })
}

function markdownItRenderer(): MarkdownRenderer {
  return {
    render(source: string, baseDir?: string): string {
      const rawHtml = md.render(source)
      const clean = sanitizeHtml(rawHtml)
      return baseDir ? resolveAttachmentSrcs(clean, baseDir) : clean
    }
  }
}

export const markdownRenderer: MarkdownRenderer = markdownItRenderer()
