import { useEffect, useState } from 'react'
import ImageIcon from '../../icons/file-img.svg?react'
import {
  CancelButton,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  FIELD_INPUT,
  FieldLabel,
  MainButton
} from '../../components/DialogParts'
import type { RemoteImageError } from '../../../../preload/index.d'

const ERROR_TEXT: Record<RemoteImageError, string> = {
  'invalid-url': '받을 수 없는 주소입니다.',
  blocked: '접근할 수 없는 주소입니다.',
  'not-image': '이미지가 아닙니다.',
  'too-large': '10MB를 넘는 이미지입니다.',
  timeout: '응답이 없습니다.',
  failed: '이미지를 받지 못했습니다.'
}

const TYPE_LABEL: Record<string, string> = {
  'image/svg+xml': 'SVG',
  'image/x-icon': 'ICO'
}

type Loaded = { data: Uint8Array; mime: string; src: string; ext: string }

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; image: Loaded }
  | { kind: 'saving'; image: Loaded }

export interface RemoteImageDialogProps {
  url: string
  width: number | null
  onSave: (data: Uint8Array, fileName: string) => Promise<void>
  onClose: (saved: boolean) => void
}

/** 받은 데이터를 data 주소로 변환 */
function toDataUrl(data: Uint8Array, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(new Blob([data as BlobPart], { type: mime }))
  })
}

/** 바이트 수를 KB·MB로 표시 */
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/** 외부 이미지를 미리 보고 img 폴더에 내려받는 창 */
export function RemoteImageDialog({
  url,
  width,
  onSave,
  onClose
}: RemoteImageDialogProps): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [baseName, setBaseName] = useState('')
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    let alive = true
    void window.api.remoteImage
      .fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          if (alive) setPhase({ kind: 'error', message: ERROR_TEXT[r.error] })
          return
        }
        const src = await toDataUrl(r.data, r.mime)
        const dot = r.name.lastIndexOf('.')
        if (!alive) return
        setBaseName(r.name.slice(0, dot))
        setPhase({
          kind: 'ready',
          image: { data: r.data, mime: r.mime, src, ext: r.name.slice(dot) }
        })
      })
      .catch(() => alive && setPhase({ kind: 'error', message: ERROR_TEXT.failed }))
    return () => {
      alive = false
    }
  }, [url])

  const image = phase.kind === 'ready' || phase.kind === 'saving' ? phase.image : null
  const name = baseName.trim()

  const download = (): void => {
    if (phase.kind !== 'ready' || !name) return
    const img = phase.image
    setPhase({ kind: 'saving', image: img })
    onSave(img.data, name + img.ext)
      .then(() => onClose(true))
      .catch(() => setPhase({ kind: 'error', message: '저장하지 못했습니다.' }))
  }

  const type = image ? (TYPE_LABEL[image.mime] ?? image.mime.slice(6).toUpperCase()) : ''
  const info = image
    ? [type, dims ? `${dims.w}×${dims.h}` : null, formatSize(image.data.length)]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <Dialog width={460} onClose={() => onClose(false)}>
      <DialogHeader icon={<ImageIcon />} title="외부 이미지" subtitle={url} />
      <DialogBody>
        <div className="flex min-h-[160px] items-center justify-center overflow-hidden rounded-xl bg-bg-mute p-3">
          {phase.kind === 'loading' && (
            <span className="text-[13px] text-text-tertiary">불러오는 중입니다.</span>
          )}
          {phase.kind === 'error' && (
            <span className="text-[13px] text-danger">{phase.message}</span>
          )}
          {image &&
            (width ? (
              <div className="flex max-w-full flex-col items-center gap-1.5">
                <div
                  className="max-w-full rounded-md border border-dashed border-text-tertiary/60 p-1"
                  style={{ width: width + 10 }}
                >
                  <img
                    src={image.src}
                    alt=""
                    className="block max-h-[260px] w-full object-contain"
                    onLoad={(e) =>
                      setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                    }
                  />
                </div>
                <span className="text-[11.5px] text-text-tertiary">폭 {width}px</span>
              </div>
            ) : (
              <img
                src={image.src}
                alt=""
                className="block max-h-[260px] max-w-full object-contain"
                onLoad={(e) =>
                  setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                }
              />
            ))}
        </div>
        {image && <p className="-mt-2 px-0.5 text-[12px] text-text-tertiary">{info}</p>}
        <label className="flex flex-col gap-1.5">
          <FieldLabel>파일 이름</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              className={`${FIELD_INPUT} min-w-0 flex-1`}
              value={baseName}
              disabled={!image}
              onChange={(e) => setBaseName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') download()
              }}
            />
            {image && <span className="text-[13px] text-text-tertiary">{image.ext}</span>}
          </div>
          <span className="px-0.5 text-[12px] text-text-tertiary">img 폴더에 저장합니다.</span>
        </label>
      </DialogBody>
      <DialogFooter>
        <CancelButton onClick={() => onClose(false)} />
        <MainButton onClick={download} disabled={phase.kind !== 'ready' || !name}>
          내려받기
        </MainButton>
      </DialogFooter>
    </Dialog>
  )
}
