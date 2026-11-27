import { useEffect, useRef } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useTabsStore } from '../stores/tabsStore'
import { matchesShortcut } from '../utils/shortcuts'
import type { ViewMode } from '../stores/settingsStore'
import type { SidebarCommand } from '../features/sidebar/Sidebar'

export interface GlobalShortcutActions {
  settingsOpen: boolean
  save: () => void
  openSearch: () => void
  newFile: () => void
  toggleSettings: () => void
  closeSettings: () => void
  openOrFocusToc: () => void
  toggleSidebar: () => void
  setViewMode: (mode: ViewMode) => void
  sidebarCommand: (command: SidebarCommand) => void
}

/** 열려 있는 탭을 순서대로 옮긴다. 끝에서는 반대쪽 끝으로 이어진다 */
function moveTab(delta: 1 | -1): void {
  const { tabs, activeTabId, setActiveTab } = useTabsStore.getState()
  if (tabs.length < 2) return
  const idx = tabs.findIndex((t) => t.id === activeTabId)
  const next = tabs[(Math.max(idx, 0) + delta + tabs.length) % tabs.length]
  setActiveTab(next.id)
}

/** n번째 탭(1부터)으로 간다. 탭이 그만큼 없으면 아무 일도 하지 않는다 */
function goToTab(n: number): void {
  const { tabs, setActiveTab } = useTabsStore.getState()
  const tab = tabs[n - 1]
  if (tab) setActiveTab(tab.id)
}

export function useGlobalShortcuts(actions: GlobalShortcutActions): void {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const a = actionsRef.current
      const { shortcuts, uiZoom, setUiZoom } = useSettingsStore.getState()

      if (matchesShortcut(e, shortcuts.save)) {
        e.preventDefault()
        a.save()
        return
      }
      if (matchesShortcut(e, shortcuts.search)) {
        e.preventDefault()
        a.openSearch()
        return
      }
      if (matchesShortcut(e, shortcuts.newNote)) {
        e.preventDefault()
        a.newFile()
        return
      }
      if (matchesShortcut(e, shortcuts.toggleSettings)) {
        e.preventDefault()
        a.toggleSettings()
        return
      }
      if (matchesShortcut(e, shortcuts.zoomIn)) {
        e.preventDefault()
        setUiZoom(uiZoom + 10)
        return
      }
      if (matchesShortcut(e, shortcuts.zoomOut)) {
        e.preventDefault()
        setUiZoom(uiZoom - 10)
        return
      }
      if (matchesShortcut(e, shortcuts.zoomReset)) {
        e.preventDefault()
        setUiZoom(100)
        return
      }
      if (matchesShortcut(e, shortcuts.toggleToc)) {
        e.preventDefault()
        a.openOrFocusToc()
        return
      }
      if (matchesShortcut(e, shortcuts.toggleSidebar)) {
        e.preventDefault()
        a.toggleSidebar()
        return
      }
      const altOnly = e.altKey && !e.ctrlKey && !e.metaKey
      if (matchesShortcut(e, shortcuts.nextTab) || (altOnly && e.key === '>')) {
        e.preventDefault()
        moveTab(1)
        return
      }
      if (matchesShortcut(e, shortcuts.prevTab) || (altOnly && e.key === '<')) {
        e.preventDefault()
        moveTab(-1)
        return
      }
      const digit = altOnly && !e.shiftKey ? /^(?:Digit|Numpad)([1-9])$/.exec(e.code) : null
      if (digit) {
        e.preventDefault()
        goToTab(Number(digit[1]))
        return
      }
      const typing = (e.target as HTMLElement | null)?.tagName
      if (typing !== 'INPUT' && typing !== 'TEXTAREA') {
        const sidebarKeys: [string, SidebarCommand][] = [
          [shortcuts.renameItem, 'rename'],
          [shortcuts.newFolder, 'newFolder'],
          [shortcuts.revealItem, 'reveal'],
          [shortcuts.exportItem, 'export']
        ]
        const hit = sidebarKeys.find(([combo]) => matchesShortcut(e, combo))
        if (hit) {
          e.preventDefault()
          a.sidebarCommand(hit[1])
          return
        }
      }
      if (matchesShortcut(e, shortcuts.viewEditor)) {
        e.preventDefault()
        a.setViewMode('editor')
        return
      }
      if (matchesShortcut(e, shortcuts.viewSplit)) {
        e.preventDefault()
        a.setViewMode('split')
        return
      }
      if (matchesShortcut(e, shortcuts.viewPreview)) {
        e.preventDefault()
        a.setViewMode('preview')
        return
      }
      if (e.key === 'Escape' && a.settingsOpen) {
        a.closeSettings()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const { uiZoom, setUiZoom } = useSettingsStore.getState()
      setUiZoom(uiZoom + (e.deltaY < 0 ? 10 : -10))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])
}
