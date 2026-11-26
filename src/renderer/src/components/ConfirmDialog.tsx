import { useEffect, useState } from 'react'
import TrashIcon from '../icons/ctx-trash.svg?react'
import UndoIcon from '../icons/tb-undo.svg?react'
import { FileTypeIcon } from './FileTypeIcon'
import {
  CancelButton,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  FieldLabel,
  ListBox,
  MainButton,
  NameBox
} from './DialogParts'
import type { BacklinkWithContext } from '../../../preload/index.d'

interface ConfirmDialogProps {
  title: string
  /** 대상 파일이나 폴더. 주면 이름 칩으로 보여준다. */
  subject?: { name: string; kind: 'file' | 'folder' }
  message?: string
  items?: string[]
  /** 이 파일을 가리키는 다른 파일들. 주면 "참조" 아코디언으로 보여준다 */
  references?: BacklinkWithContext[]
  confirmLabel: string
  danger?: boolean
  icon?: 'trash' | 'reset'
  onConfirm: () => void
  onCancel: () => void
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function Chevron({ open }: { open: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 참조하는 파일마다 접고 펼 수 있는 목록. 펼치면 줄 번호와 그 줄의 내용이 보인다 */
function ReferenceList({ references }: { references: BacklinkWithContext[] }): React.JSX.Element {
  const [open, setOpen] = useState<Set<string>>(() => new Set(references.slice(0, 1).map((r) => r.path)))
  const toggle = (path: string): void =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>참조</FieldLabel>
      <div className="max-h-[240px] divide-y divide-white/[0.05] overflow-y-auto rounded-xl bg-bg-mute">
        {references.map((ref) => {
          const expanded = open.has(ref.path)
          const name = baseName(ref.path)
          return (
            <div key={ref.path}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggle(ref.path)}
                title={ref.path}
                className="flex h-[38px] w-full items-center gap-2 px-3 text-left text-[12.5px] text-text outline-none"
              >
                <Chevron open={expanded} />
                <FileTypeIcon name={name} kind="file" size={15} raise={false} />
                <span className="min-w-0 truncate">{name}</span>
              </button>
              {expanded && (
                <div className="pb-2">
                  {ref.contexts.map((ctx) => (
                    <div
                      key={ctx.line}
                      className="flex gap-3 py-[3px] pl-9 pr-3 font-mono text-[11.5px] leading-[1.6]"
                    >
                      <span className="w-[22px] shrink-0 text-right text-text-tertiary">{ctx.line}</span>
                      <span className="min-w-0 truncate text-text-secondary">{ctx.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 삭제처럼 되돌리기 어려운 작업 전에 확인받는 가운데 모달. */
export function ConfirmDialog({
  title,
  subject,
  message,
  items,
  references,
  confirmLabel,
  danger,
  icon = 'trash',
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onConfirm])

  const Icon = icon === 'reset' ? UndoIcon : TrashIcon

  return (
    <Dialog width={420} onClose={onCancel}>
      <DialogHeader icon={<Icon width={20} height={20} />} title={title} danger={danger} />
      <DialogBody>
        {subject && (
          <NameBox>
            <FileTypeIcon name={subject.name} kind={subject.kind} size={18} raise={false} />
            <span className="min-w-0 truncate text-[13.5px] font-medium text-text">{subject.name}</span>
          </NameBox>
        )}
        {message && (
          <div className="text-[13px] leading-relaxed text-text-secondary">
            {/* 마침표 뒤에 공백이 있으면 거기서 줄을 바꾼다 ("test.md"처럼 공백 없는 점은 그대로) */}
            {message.split(/(?<=\.)\s+/).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
        {references && references.length > 0 && <ReferenceList references={references} />}
        {items && items.length > 0 && <ListBox items={items} />}
      </DialogBody>
      <DialogFooter>
        <CancelButton onClick={onCancel} />
        <MainButton onClick={onConfirm} danger={danger}>
          {confirmLabel}
        </MainButton>
      </DialogFooter>
    </Dialog>
  )
}
