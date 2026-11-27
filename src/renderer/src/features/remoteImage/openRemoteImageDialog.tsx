import { createRoot } from 'react-dom/client'
import { RemoteImageDialog } from './RemoteImageDialog'

let openCount = 0

/** 외부 이미지 창 열기. 이미 열려 있으면 무시 */
export function openRemoteImageDialog(
  url: string,
  width: number | null,
  onSave: (data: Uint8Array, fileName: string) => Promise<void>,
  onClose: (saved: boolean) => void
): void {
  if (openCount > 0) return
  openCount++
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  let closed = false
  const close = (saved: boolean): void => {
    if (closed) return
    closed = true
    openCount--
    root.unmount()
    host.remove()
    onClose(saved)
  }
  root.render(<RemoteImageDialog url={url} width={width} onSave={onSave} onClose={close} />)
}

/** 외부 이미지 창을 열고 내려받으면 img 폴더에 저장한 상대 경로 전달 */
export function promptRemoteImageDownload(
  url: string,
  width: number | null,
  noteDir: string,
  onSaved: (relPath: string) => void,
  onClose: (saved: boolean) => void = () => {}
): void {
  openRemoteImageDialog(
    url,
    width,
    async (data, fileName) => {
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      const relPath = await window.api.workspace.saveAttachment(
        noteDir,
        'img',
        fileName,
        buffer as ArrayBuffer
      )
      onSaved(relPath)
    },
    onClose
  )
}
