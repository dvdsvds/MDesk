import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ChevronDownIcon from '../../icons/tb-chevron-down.svg?react'
import {
  EDITOR_FONTS,
  FONT_SAMPLE,
  findEditorFont,
  type EditorFontOption
} from '../../utils/editorFonts'
import { INPUT } from './SettingsParts'

const LIST_WIDTH = 320

/** 에디터 글꼴을 고르는 드롭다운. 목록에서 각 글꼴의 이름과 실제 생김새를 함께 보여 준다 */
export function FontSelect({
  value,
  onChange
}: {
  value: string
  onChange: (family: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const current = findEditorFont(value)
  // 예전에 직접 적어 둔 글꼴 값이면 목록 맨 위에 "사용자 지정"으로 남겨 둔다
  const options: EditorFontOption[] = current
    ? EDITOR_FONTS
    : [{ id: 'custom', name: '사용자 지정', family: value }, ...EDITOR_FONTS]

  const openList = useCallback((): void => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - LIST_WIDTH, window.innerWidth - LIST_WIDTH - 8))
    })
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node
      if (listRef.current?.contains(t) || buttonRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    const close = (): void => setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        className={`${INPUT} flex w-64 items-center justify-between gap-2 text-left`}
      >
        <span className="truncate" style={{ fontFamily: value }}>
          {current?.name ?? '사용자 지정'}
        </span>
        <ChevronDownIcon width={14} height={14} className="shrink-0 opacity-70" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            style={{ top: pos.top, left: pos.left, width: LIST_WIDTH }}
            className="fixed z-[1000] overflow-hidden rounded-lg border border-border bg-bg-elevated py-1 shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
          >
            {options.map((o) => {
              const selected = o.family === value
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.family)
                    setOpen(false)
                  }}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-bg-mute ${
                    selected ? 'bg-accent/15' : ''
                  }`}
                >
                  <span className="text-[11.5px] text-text-tertiary">{o.name}</span>
                  <span
                    className="text-[14px] leading-snug text-text"
                    style={{ fontFamily: o.family }}
                  >
                    {FONT_SAMPLE}
                  </span>
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}
