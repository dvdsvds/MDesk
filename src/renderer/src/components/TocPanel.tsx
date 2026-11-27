import { useEffect, useRef } from 'react'
import type { TocEntry } from '../utils/toc'

interface TocPanelProps {
  entries: TocEntry[]
  onJump: (line: number) => void
  onClose: () => void
  focusToken: number
  onReturnFocus: () => void
}

/** 목차 플로팅 패널 */
export function TocPanel({
  entries,
  onJump,
  onClose,
  focusToken,
  onReturnFocus
}: TocPanelProps): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (focusToken === 0) return
    if (firstButtonRef.current) firstButtonRef.current.focus()
    else panelRef.current?.focus()
  }, [focusToken])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onReturnFocus()
    }
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed right-4 top-14 z-30 max-h-[70vh] w-64 overflow-auto rounded-xl border border-border bg-bg-elevated p-2 shadow-2xl outline-none"
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-text-secondary">목차</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded-md px-1 text-text-tertiary hover:bg-bg-mute hover:text-text"
        >
          ✕
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="px-1 py-2 text-xs text-text-tertiary">제목이 없습니다</p>
      ) : (
        <ul>
          {entries.map((entry, i) => (
            <li key={`${entry.line}-${i}`}>
              <button
                ref={i === 0 ? firstButtonRef : undefined}
                type="button"
                onClick={() => onJump(entry.line)}
                style={{ paddingLeft: `${(entry.level - 1) * 12 + 4}px` }}
                title={entry.text}
                className="block w-full truncate rounded-md py-1.5 text-left text-[13px] text-text hover:bg-bg-mute"
              >
                {entry.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
