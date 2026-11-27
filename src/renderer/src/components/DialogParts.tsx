import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface DialogProps {
  width?: number
  height?: number
  onClose?: () => void
  children: React.ReactNode
}

/** 화면 가운데에 뜨는 팝업 틀. body에 직접 그려서 툴바나 패널보다 항상 위에 보인다. */
export function Dialog({ width = 420, height, onClose, children }: DialogProps): React.JSX.Element {
  useEffect(() => {
    if (!onClose) return
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div
      className="dlg-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(8,9,12,0.45)] backdrop-blur-[10px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ width, height }}
        className="dlg-card flex max-h-[calc(100vh-48px)] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[18px] border border-white/[0.07] bg-bg-elevated"
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

export type DialogTone = 'accent' | 'danger' | 'warning'

const TONE: Record<DialogTone, string> = {
  accent: 'bg-accent/15 text-accent',
  danger: 'bg-danger/15 text-danger',
  warning: 'bg-[#f0c27a]/15 text-[#f0c27a]'
}

/** 아이콘 칸(40px). 어느 창에서나 제목 왼쪽에 놓는다 */
export function DialogIcon({
  tone = 'accent',
  children
}: {
  tone?: DialogTone
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TONE[tone]}`}
    >
      {children}
    </span>
  )
}

interface DialogHeaderProps {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle?: string
  danger?: boolean
  tone?: DialogTone
  after?: React.ReactNode
  rawIcon?: boolean
}

export function DialogHeader({
  icon,
  title,
  subtitle,
  danger,
  tone,
  after,
  rawIcon
}: DialogHeaderProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-7 pt-7">
      {rawIcon ? icon : <DialogIcon tone={tone ?? (danger ? 'danger' : 'accent')}>{icon}</DialogIcon>}
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold text-text">{title}</h2>
        {subtitle && <p className="mt-px truncate text-[12.5px] text-text-tertiary">{subtitle}</p>}
      </div>
      {after}
    </div>
  )
}

export function DialogBody({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex flex-col gap-4 px-7 pt-4">{children}</div>
}

/** 아래 버튼 줄. 버튼은 같은 너비로 나란히 놓는다. */
export function DialogFooter({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex gap-2 px-7 pb-6 pt-6 [&>*]:flex-1">{children}</div>
}

export const BTN_BASE =
  'h-8 rounded-lg px-3.5 text-[13px] focus:outline-none transition-[filter,opacity] disabled:opacity-40'
export const BTN_SECONDARY = `${BTN_BASE} bg-bg-mute font-medium text-text hover:brightness-110`
export const BTN_PRIMARY = `${BTN_BASE} bg-accent font-semibold text-text-inverted hover:brightness-110`
export const BTN_DANGER = `${BTN_BASE} bg-danger font-semibold text-white hover:brightness-110`

export function CancelButton({
  onClick,
  children = '취소'
}: {
  onClick: () => void
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <button type="button" onClick={onClick} className={BTN_SECONDARY}>
      {children}
    </button>
  )
}

export function MainButton({
  onClick,
  disabled,
  danger,
  children
}: {
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={danger ? BTN_DANGER : BTN_PRIMARY}
    >
      {children}
    </button>
  )
}

/** 파일이나 폴더 이름을 보여주는 칩. */
export function NameBox({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="inline-flex h-[38px] max-w-full items-center gap-2 self-start rounded-[10px] bg-bg-mute px-3.5">
      {children}
    </div>
  )
}

/** 입력란 위에 붙는 작은 이름표 */
export function FieldLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="px-0.5 text-[12px] font-semibold text-text-tertiary">{children}</span>
}

export const FIELD_INPUT =
  'h-[38px] rounded-[10px] border border-white/[0.08] bg-bg-mute px-3 text-[13.5px] text-text outline-none transition-shadow focus:ring-1 focus:ring-accent/60'

/** 안에 목록이 들어가는 박스. */
export function ListBox({ items }: { items: string[] }): React.JSX.Element {
  return (
    <ul className="max-h-32 overflow-auto rounded-xl bg-bg-mute p-2.5 text-xs text-text-secondary">
      {items.map((item, i) => (
        <li key={i} className="truncate" title={item}>
          {item}
        </li>
      ))}
    </ul>
  )
}
