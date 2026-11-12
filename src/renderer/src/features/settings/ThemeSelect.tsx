import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ChevronDownIcon from '../../icons/tb-chevron-down.svg?react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useThemePreviewStore } from '../../stores/themePreviewStore'
import { THEMES, findTheme, type ThemeOption } from '../../utils/themes'

function Swatch({ colors }: { colors: ThemeOption['swatch'] }): React.JSX.Element {
  return (
    <span
      className="flex h-4 w-7 shrink-0 items-center justify-center gap-[3px] rounded-[5px] border border-border-strong"
      style={{ background: colors[0] }}
    >
      <i className="block h-1.5 w-1.5 rounded-full" style={{ background: colors[1] }} />
      <i className="block h-1.5 w-1.5 rounded-full" style={{ background: colors[2] }} />
    </span>
  )
}

/**
 * 색 테마를 고르는 드롭다운. 목록에서 항목에 마우스를 올리면 위쪽 미리보기 카드가
 * 그 테마로 바뀐다(themePreviewStore).
 */
export function ThemeSelect(): React.JSX.Element {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const onHover = useThemePreviewStore((s) => s.setHovered)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const current = findTheme(theme)

  // 설정을 닫으면 마우스를 올린 상태도 지운다
  useEffect(() => () => onHover(null), [onHover])

  const openList = useCallback((): void => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    setOpen(true)
  }, [])

  const closeList = useCallback((): void => {
    setOpen(false)
    onHover(null)
  }, [onHover])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node
      if (listRef.current?.contains(t) || buttonRef.current?.contains(t)) return
      closeList()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeList()
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', closeList)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', closeList)
    }
  }, [open, closeList])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? closeList() : openList())}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg bg-text/[0.07] px-3 text-left text-[14px] text-text outline-none transition-shadow focus:ring-1 focus:ring-accent/60"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Swatch colors={current.swatch} />
          <span className="truncate">{current.name}</span>
        </span>
        <ChevronDownIcon width={14} height={14} className="shrink-0 opacity-70" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[1000] max-h-72 overflow-y-auto rounded-lg border border-border bg-bg-elevated shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
            onMouseLeave={() => onHover(null)}
          >
            {THEMES.map((o) => (
              <button
                key={o.id}
                type="button"
                onMouseEnter={() => onHover(o.id)}
                onClick={() => {
                  setTheme(o.id)
                  closeList()
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text transition-colors hover:bg-bg-mute ${
                  theme === o.id ? 'bg-accent/15' : ''
                }`}
              >
                <Swatch colors={o.swatch} />
                {o.name}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
