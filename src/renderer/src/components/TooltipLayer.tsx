import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SHOW_DELAY_MS = 400
const GAP = 6
const EDGE = 8

interface Tip {
  el: HTMLElement
  text: string
}

/** "에디터 (Ctrl+Alt+I)"처럼 끝에 단축키가 괄호로 붙어 있으면 이름과 단축키로 나눈다 */
const SHORTCUT_TAIL =
  /^([\s\S]*?)\s*\(((?:Ctrl|Cmd|Alt|Shift|F\d{1,2}|Delete|Enter|Esc|Tab|Backspace)[^()]*)\)$/

function splitTip(text: string): { label: string; keys: string | null } {
  const m = SHORTCUT_TAIL.exec(text)
  return m ? { label: m[1], keys: m[2] } : { label: text, keys: null }
}

/**
 * 앱 전체의 마우스 올림 설명(툴팁). 브라우저 기본 툴팁 대신 title 속성이 있는 요소 위에 새 모양으로 띄운다.
 * title은 마우스를 올린 순간 data-tip으로 옮겨서 기본 툴팁이 같이 뜨지 않게 한다.
 */
export function TooltipLayer(): React.JSX.Element | null {
  const [tip, setTip] = useState<Tip | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const currentRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const hide = (): void => {
      clearTimeout(timerRef.current)
      currentRef.current = null
      setTip(null)
      setPos(null)
    }
    const onOver = (e: MouseEvent): void => {
      const target = e.target as Element | null
      const el = target?.closest?.('[title], [data-tip]') as HTMLElement | null
      if (!el || el === currentRef.current) return
      const title = el.getAttribute('title')
      if (title) {
        // 기본 툴팁이 뜨지 않게 title을 옮기고, 화면 낭독기를 위해 이름은 남겨 둔다
        el.dataset.tip = title
        if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', title)
        el.removeAttribute('title')
      }
      const text = el.dataset.tip
      if (!text) return
      hide()
      currentRef.current = el
      timerRef.current = setTimeout(() => setTip({ el, text }), SHOW_DELAY_MS)
    }
    const onOut = (e: MouseEvent): void => {
      const cur = currentRef.current
      if (!cur) return
      const to = e.relatedTarget as Node | null
      if (to && cur.contains(to)) return
      hide()
    }
    window.addEventListener('mouseover', onOver, true)
    window.addEventListener('mouseout', onOut, true)
    window.addEventListener('mousedown', hide, true)
    window.addEventListener('keydown', hide, true)
    window.addEventListener('wheel', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      clearTimeout(timerRef.current)
      window.removeEventListener('mouseover', onOver, true)
      window.removeEventListener('mouseout', onOut, true)
      window.removeEventListener('mousedown', hide, true)
      window.removeEventListener('keydown', hide, true)
      window.removeEventListener('wheel', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // 보이는 동안 요소가 사라지면(탭 닫기 등) 같이 닫는다
  useEffect(() => {
    if (!tip) return
    const id = setInterval(() => {
      if (!tip.el.isConnected) {
        currentRef.current = null
        setTip(null)
        setPos(null)
      }
    }, 300)
    return () => clearInterval(id)
  }, [tip])

  // 상자 크기를 잰 뒤 요소 아래 가운데에 놓고, 자리가 없으면 위로, 가장자리에서는 안쪽으로 민다
  useLayoutEffect(() => {
    if (!tip || !boxRef.current) return
    const r = tip.el.getBoundingClientRect()
    const b = boxRef.current.getBoundingClientRect()
    let top = r.bottom + GAP
    if (top + b.height > window.innerHeight - EDGE) top = Math.max(EDGE, r.top - GAP - b.height)
    const left = Math.min(
      Math.max(EDGE, r.left + r.width / 2 - b.width / 2),
      window.innerWidth - EDGE - b.width
    )
    setPos({ top, left })
  }, [tip])

  if (!tip) return null
  const { label, keys } = splitTip(tip.text)
  return createPortal(
    <div
      ref={boxRef}
      role="tooltip"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        opacity: pos ? 1 : 0,
        transform: pos ? 'translateY(0)' : 'translateY(2px)'
      }}
      className="pointer-events-none fixed z-[2000] flex max-w-[360px] items-center gap-2 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-[12px] leading-snug text-text shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition-[opacity,transform] duration-[120ms] ease-out"
    >
      <span className="whitespace-pre-line break-all">{label}</span>
      {keys && (
        <span className="shrink-0 rounded-md bg-bg-mute px-1.5 py-0.5 text-[11px] tabular-nums text-text-secondary">
          {keys}
        </span>
      )}
    </div>,
    document.body
  )
}
