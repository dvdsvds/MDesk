import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const SELECTOR = 'details.accordion'

/** 임베드로 끼워 넣은 다른 노트의 아코디언은 이 노트의 순서에 넣지 않는다 */
function ownAccordions(el: HTMLElement): HTMLDetailsElement[] {
  return Array.from(el.querySelectorAll<HTMLDetailsElement>(SELECTOR)).filter(
    (d) => !d.closest('.embed-body')
  )
}

/**
 * 미리보기는 글을 고칠 때마다 HTML이 통째로 다시 그려져서 펼쳐 둔 아코디언이 모두 접힌다.
 * 몇 번째 아코디언이 펼쳐져 있는지 기억했다가 다시 그린 뒤에 되돌린다. 다른 노트로 바꾸면 초기화한다.
 */
export function useAccordionState(
  containerRef: RefObject<HTMLDivElement | null>,
  html: string,
  docKey: string | undefined
): void {
  const stateRef = useRef<{ key: string | undefined; open: Map<number, boolean> }>({
    key: docKey,
    open: new Map()
  })

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (stateRef.current.key !== docKey) stateRef.current = { key: docKey, open: new Map() }
    ownAccordions(el).forEach((d, i) => {
      if (stateRef.current.open.get(i)) d.open = true
    })
  }, [containerRef, html, docKey])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // toggle 이벤트는 위로 올라가지 않으므로 캡처 단계에서 듣는다
    const onToggle = (e: Event): void => {
      const d = e.target
      if (!(d instanceof HTMLDetailsElement) || !d.matches(SELECTOR)) return
      const index = ownAccordions(el).indexOf(d)
      if (index >= 0) stateRef.current.open.set(index, d.open)
    }
    el.addEventListener('toggle', onToggle, true)
    return () => el.removeEventListener('toggle', onToggle, true)
  }, [containerRef])
}
