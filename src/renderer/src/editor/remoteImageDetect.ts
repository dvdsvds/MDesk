import type { EditorState, Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import {
  findExternalImages,
  isCompleteUrl,
  urlReplacements,
  type ExternalImage
} from '../features/remoteImage/remoteImageSyntax'
import { promptRemoteImageDownload } from '../features/remoteImage/openRemoteImageDialog'

const dismissed = new Set<string>()
const GITHUB_COPY_RE = /[\\/]\.ghmd[\\/]/

/** 위치를 포함하는 외부 이미지 문법 */
function imageAt(state: EditorState, pos: number): ExternalImage | null {
  const line = state.doc.lineAt(pos)
  return findExternalImages(line.text, line.from).find((i) => i.from <= pos && pos <= i.to) ?? null
}

/** 외부 이미지 창을 열고 내려받으면 원문 주소를 로컬 경로로 교체 */
export function promptRemoteImage(view: EditorView, image: ExternalImage, noteDir: string): void {
  promptRemoteImageDownload(
    image.url,
    image.width,
    noteDir,
    (relPath) => {
      const changes = urlReplacements(view.state.doc.toString(), image.url, relPath)
      if (changes.length) view.dispatch({ changes, userEvent: 'input.remote-image' })
    },
    (saved) => {
      if (!saved) dismissed.add(image.url)
      view.focus()
    }
  )
}

/** 직접 입력하거나 붙여넣은 외부 이미지 주소를 감지해 내려받기 창 열기 */
export function remoteImageDetect(getAttachmentDir: () => string): Extension {
  return ViewPlugin.fromClass(
    class {
      pending: number | null = null

      constructor(readonly view: EditorView) {}

      update(update: ViewUpdate): void {
        const noteDir = getAttachmentDir()
        if (!noteDir || GITHUB_COPY_RE.test(noteDir + '/')) {
          this.pending = null
          return
        }
        if (this.pending !== null && update.docChanged)
          this.pending = update.changes.mapPos(this.pending, 1)
        const state = update.state
        const head = state.selection.main.head
        const userTrs = update.transactions.filter(
          (tr) => tr.docChanged && (tr.isUserEvent('input') || tr.isUserEvent('delete'))
        )
        const ownEdit = update.transactions.some((tr) => tr.isUserEvent('input.remote-image'))
        if (userTrs.length && !ownEdit) {
          const here = imageAt(state, head)
          if (here && here.from < head && head < here.to && !dismissed.has(here.url)) {
            if (userTrs.some((tr) => tr.isUserEvent('input.paste')) && isCompleteUrl(here.url)) {
              this.pending = null
              this.open(here, noteDir)
              return
            }
            this.pending = here.from
            return
          }
        }
        if (this.pending === null || !(update.selectionSet || update.docChanged)) return
        const image = imageAt(state, this.pending)
        if (!image) {
          this.pending = null
          return
        }
        if (head > image.from && head < image.to) return
        this.pending = null
        if (isCompleteUrl(image.url) && !dismissed.has(image.url)) this.open(image, noteDir)
      }

      open(image: ExternalImage, noteDir: string): void {
        setTimeout(() => promptRemoteImage(this.view, image, noteDir), 0)
      }
    }
  )
}
