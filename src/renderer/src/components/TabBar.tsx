import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Tab } from '../stores/tabsStore'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { tabLabel } from '../utils/tabLabel'
import { FileTypeIcon } from './FileTypeIcon'
import { fileNameOf } from '../utils/path'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onSelect: (tabId: string) => void
  onClose: (tabId: string) => void
  onCloseAll: () => void
  onMissingClick: (tab: Tab) => void
}

/** 소문자보다 키가 큰 글자(대문자·숫자·한글). 하나라도 있으면 대문자 키로 가운데를 잡는다 */
const TALL_CHARS = /[A-Z0-9ㄱ-ㆎ가-힣]/

function CloseGlyph(): React.JSX.Element {
  return (
    <svg
      // 16px 버튼 안에 짝수(10px)로 둬야 위아래 3px로 떨어진다. × 크기는 9px일 때와 같게 맞춘다
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    >
      <path d="M2.3 2.3l5.4 5.4M7.7 2.3l-5.4 5.4" />
    </svg>
  )
}

export function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onCloseAll,
  onMissingClick
}: TabBarProps): React.JSX.Element | null {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tab: Tab } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  // 보이는 탭 범위 [start, end). 탭 줄은 탭 하나 단위로 스크롤돼서 반쯤 잘린 탭이 생기지 않는다
  const startRef = useRef(0)
  const lastActiveRef = useRef<string | null>(null)
  const [range, setRange] = useState<{ start: number; end: number } | null>(null)

  // 숨긴 탭도 폭을 재야 해서 화면 밖에 겹쳐 그려 두고, 앞에서부터 다 들어가는 만큼만 보인다
  const layout = useCallback(
    (shift = 0): void => {
      const box = boxRef.current
      const area = box?.parentElement
      if (!box || !area || tabs.length === 0) return
      const style = getComputedStyle(area)
      const avail =
        area.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const widthOf = new Map<string, number>()
      for (const el of Array.from(box.children) as HTMLElement[]) {
        if (el.dataset.tabId) widthOf.set(el.dataset.tabId, el.offsetWidth)
      }
      const w = (i: number): number => widthOf.get(tabs[i].id) ?? 0
      const endFrom = (from: number): number => {
        let used = 0
        let i = from
        while (i < tabs.length && used + w(i) <= avail) used += w(i++)
        return Math.max(i, from + 1)
      }
      let start = Math.min(Math.max(0, startRef.current + shift), tabs.length - 1)
      // 휠로 넘길 때는 뒤에 더 볼 탭이 있을 때만 앞으로 간다
      if (shift > 0 && endFrom(startRef.current) >= tabs.length) start = startRef.current
      // 탭을 바꿨을 때만 지금 탭이 보이게 범위를 옮긴다(휠로 넘긴 뒤에는 그대로 둔다)
      const activeIdx = tabs.findIndex((t) => t.id === activeTabId)
      if (activeIdx >= 0 && activeTabId !== lastActiveRef.current) {
        lastActiveRef.current = activeTabId
        if (activeIdx < start) start = activeIdx
        else if (activeIdx >= endFrom(start)) {
          let used = 0
          start = activeIdx
          while (start > 0 && used + w(start) + w(start - 1) <= avail) used += w(start--)
        }
      }
      // 창이 넓어져 뒤가 비면 앞쪽 탭을 다시 채운다
      while (start > 0 && endFrom(start - 1) >= tabs.length && endFrom(start) >= tabs.length) {
        let used = 0
        for (let i = start - 1; i < tabs.length; i++) used += w(i)
        if (used > avail) break
        start--
      }
      startRef.current = start
      const end = endFrom(start)
      setRange((prev) => (prev && prev.start === start && prev.end === end ? prev : { start, end }))
    },
    [tabs, activeTabId]
  )

  useLayoutEffect(() => {
    const area = boxRef.current?.parentElement
    if (!area) return
    layout()
    const ro = new ResizeObserver(() => layout())
    ro.observe(area)
    return () => ro.disconnect()
  }, [layout])

  if (tabs.length === 0) return null

  const menuItems: ContextMenuItem[] = contextMenu
    ? [
        { label: '닫기', onClick: () => onClose(contextMenu.tab.id) },
        { label: '모두 닫기', onClick: () => onCloseAll() },
        ...(contextMenu.tab.filePath
          ? [
              {
                label: '폴더에서 보기',
                onClick: () => void window.api.workspace.reveal(contextMenu.tab.filePath as string)
              },
              {
                label: '경로 복사',
                onClick: () =>
                  void window.api.workspace.copyPath(contextMenu.tab.filePath as string, false)
              }
            ]
          : [])
      ]
    : []

  // 타이틀바(36px) 가운데에 24px 줄로 들어간다 → 위아래 6px.
  // 줄 안쪽 높이 24px 기준: 아이콘(14px) 위아래 5px, ×(16px) 4px.
  // no-drag는 탭 하나하나가 아니라 이 상자에만 준다. 스크롤 밖으로 넘친 탭의 no-drag 영역은
  // 상자 경계에서 잘리지 않아(Chromium) 창 버튼 앞 빈 곳까지 덮어 끌기가 막혔다.
  // 상자 폭은 보이는 탭 길이만큼이라, 그 오른쪽 빈 곳은 그대로 창 끌기 영역이다
  return (
    <div
      ref={boxRef}
      onWheel={(e) => {
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
        if (d !== 0) layout(d > 0 ? 1 : -1)
      }}
      className="relative flex h-full min-w-0 items-stretch overflow-hidden"
    >
      {tabs.map((tab, i) => {
        const isActive = tab.id === activeTabId
        const label = tabLabel(tab)
        const hidden = range !== null && (i < range.start || i >= range.end)
        return (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            aria-hidden={hidden || undefined}
            onClick={() => (tab.missing ? onMissingClick(tab) : onSelect(tab.id))}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                onClose(tab.id)
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ x: e.clientX, y: e.clientY, tab })
            }}
            className={`group flex h-full min-w-0 max-w-[200px] shrink-0 cursor-pointer ${hidden ? 'pointer-events-none invisible absolute left-0 top-0 w-max' : 'relative'} items-center gap-1 border-r border-border pr-1 text-[12.5px] transition-colors pl-3 ${
              isActive ? 'font-medium text-text' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {/* 선택된 탭 표시. 글자 굵기만으로는 잘 안 보여서 탭 아래에 강조색 막대(2px)를 둔다 */}
            {isActive && (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent" />
            )}
            <span className="relative flex shrink-0">
              <FileTypeIcon name={tab.filePath ? fileNameOf(tab.filePath) : '제목 없음.md'} kind="file" size={14} />
            </span>
            {/* 글자 상자를 글자 윗선~기준선으로 잘라서, 글꼴의 위아래 여백과 상관없이 정확히 가운데에 놓는다.
                기준은 대문자 키(cap). 소문자뿐인 이름은 키가 작아 처져 보여서 1px만 올린다
                (소문자 키(ex) 기준으로 잡으면 1.3~1.5px 올라가 오히려 떠 보인다. 소수점이 안 생기게 정수 1px).
                세로는 자르지 않도록 overflow-x만 clip */}
            <span
              className={`relative min-w-0 flex-1 overflow-x-clip text-ellipsis whitespace-nowrap [text-box:trim-both_cap_alphabetic] ${TALL_CHARS.test(label) ? '' : '-top-px'} ${tab.missing ? 'text-danger line-through' : ''}`}
              title={tab.missing ? '파일이 없어요' : undefined}
            >
              {label}
            </span>
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              {tab.dirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary group-hover:hidden" />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.id)
                }}
                aria-label="닫기"
                className={`absolute inset-0 items-center justify-center rounded text-text-tertiary hover:bg-bg-mute hover:text-text ${
                  tab.dirty
                    ? 'hidden group-hover:flex'
                    : isActive
                      ? 'flex'
                      : 'flex opacity-0 group-hover:opacity-100'
                }`}
              >
                <CloseGlyph />
              </button>
            </span>
          </div>
        )
      })}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
