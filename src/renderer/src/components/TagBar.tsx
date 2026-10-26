import { useEffect, useRef, useState } from 'react'
import ChevronDownIcon from '../icons/tb-chevron-down.svg?react'
import { useNotePropsStore } from '../stores/notePropsStore'
import {
  PROPERTY_COLORS,
  STATUS_OPTIONS,
  statusOf,
  type PropertyColor
} from '../utils/noteProperties'

/** 값 목록을 여는 방향. 상태 표시줄은 화면 맨 아래라 위로, 탭에서 열 때는 아래로 */
export type MenuDirection = 'up' | 'down'

function Chip({ label, color }: { label: string; color: PropertyColor }): React.JSX.Element {
  const c = PROPERTY_COLORS[color]
  return (
    <span
      className="flex h-5 w-full items-center justify-center rounded-md px-1 text-[12px] font-medium"
      style={{ background: `${c}26`, color: c }}
    >
      {label}
    </span>
  )
}

/** 노트 상태(대기·진행·보류·완료)를 고르는 칸. 정하지 않은 노트는 진행으로 보인다 */
export function TagBar({
  filePath,
  menuDirection = 'up',
  children
}: {
  filePath: string
  menuDirection?: MenuDirection
  /** 상태 앞에 붙일 것 (데일리 노트 이동 버튼 등) */
  children?: React.ReactNode
}): React.JSX.Element {
  const value = useNotePropsStore((s) => s.byPath[filePath]?.status)
  const setProps = useNotePropsStore((s) => s.setProps)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const current = statusOf(value)
  const chipColor = PROPERTY_COLORS[current.color]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const change = (next: string): void => {
    setProps(filePath, { status: next })
    setOpen(false)
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {children}
      <div ref={boxRef} className="relative flex items-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={`상태: ${current.label}`}
          className="flex h-5 items-center gap-0.5 rounded-md pl-2.5 pr-1.5 text-[12px] font-medium outline-none"
          style={{ background: `${chipColor}26`, color: chipColor }}
        >
          {current.label}
          <ChevronDownIcon width={12} height={12} className="opacity-70" />
        </button>
        {open && (
          <div
            className={`absolute z-50 w-max min-w-full overflow-hidden rounded-lg border border-border bg-bg-elevated py-1 shadow-[0_8px_24px_rgba(0,0,0,0.25)] ${menuDirection === 'up' ? 'bottom-full right-0 mb-1' : 'left-0 top-full mt-1'}`}
          >
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => change(o.label)}
                className="flex h-7 w-full items-center px-1 transition-opacity hover:opacity-80"
              >
                <Chip label={o.label} color={o.color} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
