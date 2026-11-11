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
  toggleTodo: () => void
  toggleBacklinks: () => void
  toggleSidebar: () => void
  toggleGraph: () => void
  /** 보기 모드를 바꾼다. 마크다운 노트가 아니면 아무 일도 하지 않는다 */
  setViewMode: (mode: ViewMode) => void
  /** 사이드바에서 선택된 항목에 실행하는 동작(이름 바꾸기 등) */
  sidebarCommand: (command: SidebarCommand) => void
}

function copyActivePath(e: KeyboardEvent, relative: boolean): void {
  const { tabs, activeTabId } = useTabsStore.getState()
  const tab = tabs.find((t) => t.id === activeTabId)
  if (!tab?.filePath) return
  e.preventDefault()
  void window.api.workspace.copyPath(tab.filePath, relative)
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
      if (matchesShortcut(e, shortcuts.copyPathAbsolute)) {
        copyActivePath(e, false)
        return
      }
      if (matchesShortcut(e, shortcuts.copyPathRelative)) {
        copyActivePath(e, true)
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
      if (matchesShortcut(e, shortcuts.todoDashboard)) {
        e.preventDefault()
        a.toggleTodo()
        return
      }
      if (matchesShortcut(e, shortcuts.backlinks)) {
        e.preventDefault()
        a.toggleBacklinks()
        return
      }
      if (matchesShortcut(e, shortcuts.toggleSidebar)) {
        e.preventDefault()
        a.toggleSidebar()
        return
      }
      if (matchesShortcut(e, shortcuts.graph)) {
        e.preventDefault()
        a.toggleGraph()
        return
      }
      // 사이드바 동작: 이름 입력칸 같은 곳에서 글을 칠 때는 건드리지 않는다
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
