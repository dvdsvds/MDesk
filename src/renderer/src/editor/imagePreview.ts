import { Facet, StateEffect, type Extension, type Range as CmRange } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { isImageTarget, joinPath, parseEmbed, resolveEmbedFile } from '../utils/embed'
import { flattenFilePaths } from '../utils/noteIndex'
import { snoteUrl } from '../utils/snoteUrl'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { promptRemoteImage } from './remoteImageDetect'
import { githubRawInfo, remoteImageSrc, resolveRepoImage } from '../features/github/githubImages'

const EMBED_RE = /!\[\[([^[\]\n]+)\]\]/g
const MD_RE = /!\[([^\]\n]*)\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+"[^"\n]*")?\s*\)/g
const GITHUB_COPY_RE = /[\\/]\.ghmd[\\/]/
const MAX_HEIGHT = 320
const refreshImages = StateEffect.define<null>()

/** 에디터가 연 파일이 GitHub 사본이면 그 경로 */
export const githubFileFacet = Facet.define<string | null, string | null>({
  combine: (values) => values.find((v) => !!v) ?? null
})

type GithubInfo = { rawBase: string; path: string }

class LocalImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly label: string,
    readonly width: number | null
  ) {
    super()
  }
  eq(other: LocalImageWidget): boolean {
    return other.src === this.src && other.width === this.width
  }
  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-image'
    const img = document.createElement('img')
    img.src = this.src
    img.alt = ''
    img.draggable = false
    if (this.width) img.style.width = `${this.width}px`
    img.addEventListener('load', () => view.requestMeasure())
    img.addEventListener('error', () => {
      wrap.className = 'cm-image-missing'
      wrap.textContent = `'${this.label}' 파일을 찾을 수 없습니다.`
      view.requestMeasure()
    })
    wrap.append(img)
    return wrap
  }
  ignoreEvent(): boolean {
    return false
  }
}

class RemoteImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly width: number | null,
    readonly noteDir: string
  ) {
    super()
  }
  eq(other: RemoteImageWidget): boolean {
    return other.url === this.url && other.width === this.width
  }
  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('span')
    box.className = 'cm-remote-image'
    if (this.width) box.style.width = `${this.width}px`
    const text = document.createElement('span')
    text.className = 'cm-remote-image-text'
    const title = document.createElement('span')
    title.textContent = '외부 이미지는 표시하지 않습니다.'
    const url = document.createElement('span')
    url.className = 'cm-remote-image-url'
    url.textContent = this.url
    url.title = this.url
    text.append(title, url)
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = '내려받기'
    button.addEventListener('mousedown', (e) => e.preventDefault())
    button.addEventListener('click', () => {
      const from = view.posAtDOM(box)
      promptRemoteImage(view, { from, to: from, url: this.url, width: this.width }, this.noteDir)
    })
    box.append(text, button)
    return box
  }
  ignoreEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.closest('button') !== null
  }
}

const inCode = (view: EditorView, pos: number): boolean => {
  let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(pos, 1)
  for (; node; node = node.parent) if (/Code|Comment/.test(node.name)) return true
  return false
}

/** 이미지 문법의 대상을 보여 줄 위젯 */
function widgetFor(
  target: string,
  width: number | null,
  byName: boolean,
  noteDir: string,
  files: () => string[]
): WidgetType | null {
  if (/^https?:\/\//i.test(target)) {
    if (GITHUB_COPY_RE.test(noteDir + '/')) return null
    return new RemoteImageWidget(target, width, noteDir)
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || !isImageTarget(target)) return null
  let path = target
  try {
    path = decodeURIComponent(target)
  } catch {}
  const resolved = (byName && resolveEmbedFile(path, noteDir, files())) || joinPath(noteDir, path)
  return new LocalImageWidget(snoteUrl(resolved), target, width)
}

/** GitHub 파일의 상대 경로 이미지를 저장소 원본으로 보여 줄 위젯 */
function githubWidgetFor(target: string, info: GithubInfo): WidgetType | null {
  const url = resolveRepoImage(info.rawBase, info.path, target)
  return url ? new LocalImageWidget(remoteImageSrc(url), target, null) : null
}

/** 커서가 없는 이미지 문법을 이미지로 바꿔 보여 준다 */
function build(
  view: EditorView,
  getAttachmentDir: () => string,
  github: GithubInfo | null | undefined
): DecorationSet {
  if (github === undefined) return Decoration.none
  if (github) {
    const ranges: CmRange<Decoration>[] = []
    const sel = view.state.selection
    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to)
      for (const m of text.matchAll(MD_RE)) {
        const start = from + m.index
        const end = start + m[0].length
        const widget = githubWidgetFor(m[2].replace(/^<|>$/g, ''), github)
        if (!widget || sel.ranges.some((r) => r.from <= end && r.to >= start)) continue
        if (inCode(view, start)) continue
        ranges.push(Decoration.replace({ widget }).range(start, end))
      }
    }
    return Decoration.set(ranges, true)
  }
  const noteDir = getAttachmentDir()
  if (!noteDir) return Decoration.none
  let fileList: string[] | null = null
  const files = (): string[] => (fileList ??= flattenFilePaths(useWorkspaceStore.getState().tree))
  const ranges: CmRange<Decoration>[] = []
  const sel = view.state.selection
  const add = (start: number, end: number, widget: WidgetType | null): void => {
    if (!widget) return
    if (sel.ranges.some((r) => r.from <= end && r.to >= start)) return
    if (inCode(view, start)) return
    ranges.push(Decoration.replace({ widget }).range(start, end))
  }
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    for (const m of text.matchAll(EMBED_RE)) {
      const p = parseEmbed(m[1])
      const start = from + m.index
      add(start, start + m[0].length, widgetFor(p.target, p.width, true, noteDir, files))
    }
    for (const m of text.matchAll(MD_RE)) {
      const src = m[2].replace(/^<|>$/g, '')
      const start = from + m.index
      add(start, start + m[0].length, widgetFor(src, null, false, noteDir, files))
    }
  }
  return Decoration.set(ranges, true)
}

const theme = EditorView.baseTheme({
  '.cm-image': { display: 'inline-block', verticalAlign: 'bottom', maxWidth: '100%' },
  '.cm-image img': {
    display: 'block',
    maxWidth: '100%',
    maxHeight: `${MAX_HEIGHT}px`,
    objectFit: 'contain',
    borderRadius: '6px'
  },
  '.cm-image-missing': { color: 'var(--color-text-tertiary)', fontSize: '0.9em' },
  '.cm-remote-image': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    boxSizing: 'border-box',
    maxWidth: '100%',
    minWidth: '240px',
    padding: '10px 12px',
    border: '1px dashed var(--color-text-tertiary)',
    borderRadius: '8px',
    verticalAlign: 'bottom'
  },
  '.cm-remote-image-text': {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '0',
    flex: '1',
    fontSize: '0.88em',
    lineHeight: '1.4'
  },
  '.cm-remote-image-url': {
    color: 'var(--color-text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  '.cm-remote-image button': {
    flexShrink: '0',
    height: '28px',
    padding: '0 12px',
    borderRadius: '8px',
    background: 'var(--color-accent)',
    color: 'var(--color-text-inverted)',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer'
  }
})

/** 에디터에서 이미지 문법을 이미지로 표시 */
export function imagePreview(getAttachmentDir: () => string): Extension[] {
  return [
    theme,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet
        github: GithubInfo | null | undefined
        constructor(view: EditorView) {
          const githubFile = view.state.facet(githubFileFacet)
          this.github = githubFile ? undefined : null
          this.decorations = build(view, getAttachmentDir, this.github)
          if (!githubFile) return
          void githubRawInfo(githubFile).then((info) => {
            this.github = info
            if (!this.destroyed) view.dispatch({ effects: refreshImages.of(null) })
          })
        }
        destroyed = false
        destroy(): void {
          this.destroyed = true
        }
        update(u: ViewUpdate): void {
          const refresh = u.transactions.some((tr) => tr.effects.some((e) => e.is(refreshImages)))
          if (refresh || u.docChanged || u.viewportChanged || u.selectionSet)
            this.decorations = build(u.view, getAttachmentDir, this.github)
        }
      },
      { decorations: (v) => v.decorations }
    )
  ]
}
