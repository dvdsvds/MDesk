import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MarkdownEditor, type MarkdownEditorHandle } from './editor/MarkdownEditor'
import { MarkdownPreview, type MarkdownPreviewHandle } from './features/preview/MarkdownPreview'
import { Sidebar, type SidebarHandle } from './features/sidebar/Sidebar'
import { TabBar } from './components/TabBar'
import { ViewModeSwitch } from './components/ViewModeSwitch'
import { SaveChangesDialog } from './components/SaveChangesDialog'
import { useTabClose } from './hooks/useTabClose'
import { useSidebarResize } from './hooks/useSidebarResize'
import { EDITOR_MIN_WIDTH, SPLIT_GAP, SPLIT_RATIO } from './utils/splitLayout'
import { restoreOpenTabs, usePersistOpenTabs } from './hooks/useOpenTabsPersistence'
import { SearchPanel } from './components/SearchPanel'
import { SettingsPanel } from './features/settings/SettingsPanel'
import { ToastStack } from './components/ToastStack'
import { DiffView } from './components/DiffView'
import { HistoryDialog } from './components/HistoryDialog'
import { RecoveryDialog } from './components/RecoveryDialog'
import { ChangelogDialog } from './components/ChangelogDialog'
import { TocPanel } from './components/TocPanel'
import { TodoDialog } from './components/TodoDialog'
import { BacklinksPanel } from './components/BacklinksPanel'
import { toggleTaskAtLine } from './utils/tasks'
import { TitleBar } from './components/TitleBar'
import { useAppliedTheme } from './stores/useAppliedTheme'
import { useAppliedFonts } from './stores/useAppliedFonts'
import { useAppliedSnippets } from './stores/useAppliedSnippets'
import { useAppliedZoom } from './stores/useAppliedZoom'
import { useWorkspaceStore } from './stores/workspaceStore'
import { useTabsStore, type Tab } from './stores/tabsStore'
import { useSettingsStore } from './stores/settingsStore'
import { useToastStore } from './stores/toastStore'
import { flattenFilePaths, flattenNotes } from './utils/noteIndex'
import { findHeadingLine } from './utils/wikilink'
import { useCursorStore } from './stores/cursorStore'
import { buildDailyContent, dailyNoteDate, dailyNotePath } from './utils/dailyNote'
import { DailyNav } from './components/DailyNav'
import { applyTemplate, type NoteTemplate } from './utils/noteTemplate'
import { getCurrentView } from './editor/currentView'
import { extractToc } from './utils/toc'
import SidebarIcon  from './icons/sidebar.svg?react'
import { readTextFile, fileKindOf, isMarkdownPath } from './utils/fileKind'
import { FileViewer } from './components/FileViewer'
import { EmptyState } from './components/EmptyState'
import { StatusBar } from './components/StatusBar'
import { ActivityBar, ACTIVITY_BAR_WIDTH } from './components/ActivityBar'
import SearchIcon from './icons/search.svg?react'
import { useWorkspaceEvents } from './hooks/useWorkspaceEvents'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { dirOf, fileNameOf, splitName, sepOf } from './utils/path'
import { GraphDialog } from './components/GraphDialog'
import { useNotePropsStore } from './stores/notePropsStore'
import { TagBar } from './components/TagBar'
import { EditorHeader } from './components/EditorHeader'

/** 본문 카드(에디터·미리보기·뷰어). 네 모서리가 둥글고 창 오른쪽 끝과도 4px 띄운다.
 *  카드 상자는 overflow-clip을 쓴다. hidden이면 에디터의 scrollIntoView가 카드 상자까지 밀어 올려
 *  미리보기 첫 줄 위 여백이 사라졌다(base.css의 #root와 같은 이유) */
const CARD = 'rounded-xl border border-border bg-bg'

/** 보기 모드를 바꿀 때 에디터·미리보기 폭이 움직이는 시간과 곡선 */
const VIEW_TRANSITION = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const }

const TITLE_BTN =
  'flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-mute hover:text-text'

function resolveNotePath(filePath: string): string {
  const norm = (p: string): string => p.replace(/\\/g, '/')
  const note = flattenNotes(useWorkspaceStore.getState().tree).find(
    (n) => norm(n.path) === norm(filePath)
  )
  return note?.path ?? filePath
}

interface RecoverableItem {
  tmpPath: string
  targetPath: string
  tmpContent: string
  currentContent: string | null
}

interface DiffPopupState {
  oldContent: string
  newContent: string
  oldLabel: string
  newLabel: string
  onApply: () => void
  onRestore: () => void
}

function App(): React.JSX.Element {
  useAppliedTheme()
  useAppliedFonts()
  useAppliedSnippets()
  useAppliedZoom()
  useWorkspaceEvents()
  usePersistOpenTabs()

  const rootDir = useWorkspaceStore((s) => s.rootDir)
  const tree = useWorkspaceStore((s) => s.tree)
  const setTree = useWorkspaceStore((s) => s.setTree)
  const setRootDir = useWorkspaceStore((s) => s.setRootDir)
  const tabs = useTabsStore((s) => s.tabs)
  const activeTabId = useTabsStore((s) => s.activeTabId)
  const openFile = useTabsStore((s) => s.openFile)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)
  const setContent = useTabsStore((s) => s.setContent)
  const markSaved = useTabsStore((s) => s.markSaved)
  const closeTab = useTabsStore((s) => s.closeTab)
  const renamePath = useTabsStore((s) => s.renamePath)
  const rewriteWikilinks = useTabsStore((s) => s.rewriteWikilinks)
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const tagBarPath = activeTab?.kind === 'text' && !activeTab.missing && activeTab.filePath?.toLowerCase().endsWith('.md') ? activeTab.filePath : null
  const isViewer = activeTab !== null && activeTab.kind !== 'text'
  const dailyFolderSetting = useSettingsStore((s) => s.dailyFolder)
  const dailyFormatSetting = useSettingsStore((s) => s.dailyFormat)
  const activeDailyDate = useMemo(
    () => (tagBarPath ? dailyNoteDate(tagBarPath) : null),
    // 설정이 바뀌면 다시 판단한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tagBarPath, rootDir, dailyFolderSetting, dailyFormatSetting]
  )
  const showPreview = !activeTab?.filePath || isMarkdownPath(activeTab.filePath)
  const viewMode = useSettingsStore((s) => s.viewMode)
  const setViewMode = useSettingsStore((s) => s.setViewMode)
  // 마크다운이 아닌 파일은 미리보기가 없으니 늘 에디터만 보인다
  const splitMode = showPreview && viewMode === 'split'
  const previewOnly = showPreview && viewMode === 'preview'
  const showPreviewPane = showPreview && viewMode !== 'editor'
  const sidebarRef = useRef<SidebarHandle>(null)

  const splitRef = useRef<HTMLDivElement>(null)
  const [previewMinWidth, setPreviewMinWidth] = useState(0)
  const sidebar = useSidebarResize()
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed)
  // 폭 애니메이션은 px 값끼리만 움직일 수 있어서 본문 영역 폭을 재서 카드 폭을 직접 계산한다
  const [splitEl, setSplitEl] = useState<HTMLDivElement | null>(null)
  const [boxW, setBoxW] = useState(0)
  const setSplitBox = useCallback((el: HTMLDivElement | null) => {
    splitRef.current = el
    setSplitEl(el)
    if (el) setBoxW(el.clientWidth)
  }, [])
  useLayoutEffect(() => {
    if (!splitEl) return
    const ro = new ResizeObserver(() => setBoxW(splitEl.clientWidth))
    ro.observe(splitEl)
    return () => ro.disconnect()
  }, [splitEl])
  // 보기 모드 버튼을 눌렀을 때만 움직이고, 창 크기를 줄일 때는 바로 따라간다
  const [animating, setAnimating] = useState(false)
  useEffect(() => {
    if (!animating) return
    const t = setTimeout(() => setAnimating(false), 320)
    return () => clearTimeout(t)
  }, [animating])
  const gapW = splitMode ? SPLIT_GAP : 0
  const editorW = previewOnly
    ? 0
    : splitMode
      ? Math.max(
          EDITOR_MIN_WIDTH,
          Math.min(SPLIT_RATIO * boxW, boxW - previewMinWidth - SPLIT_GAP)
        )
      : boxW
  const previewW = previewOnly ? boxW : Math.max(0, boxW - editorW - gapW)
  const widthTransition = animating ? VIEW_TRANSITION : { duration: 0 }
  // 카드 폭이 변하는 동안 안쪽 내용 폭은 최종 폭으로 고정한다. 매 프레임 줄바꿈을 다시 계산하지 않아 부드럽다
  // (폭이 0이 되는 에디터는 마지막 폭을 유지한다)
  const [lastEditorW, setLastEditorW] = useState(0)
  if (editorW > 0 && editorW !== lastEditorW) setLastEditorW(editorW)
  const editorContentW = editorW > 0 ? editorW : lastEditorW

  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [diffPopup, setDiffPopup] = useState<DiffPopupState | null>(null)
  const [historyTarget, setHistoryTarget] = useState<{ filePath: string; content: string } | null>(
    null
  )
  const [recoveryItems, setRecoveryItems] = useState<RecoverableItem[] | null>(null)
  const [changelog, setChangelog] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(false)
  const [tocFocusToken, setTocFocusToken] = useState(0)
  const [todoOpen, setTodoOpen] = useState(false)
  const [backlinksOpen, setBacklinksOpen] = useState(false)
  const [graphOpen, setGraphOpen] = useState(false)
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null)
  const pushToast = useToastStore((s) => s.push)
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const previewRef = useRef<MarkdownPreviewHandle>(null)
  const scrollSourceRef = useRef<'editor' | 'preview' | 'jump' | null>(null)
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 특정 줄로 이동할 때는 에디터와 미리보기를 각각 그 위치로 맞추고,
  // 그 직후 생기는 스크롤 이벤트로 서로를 비율로 다시 끌고 가지 않게 잠깐 동기화를 멈춘다
  const jumpToLine = useCallback((line: number) => {
    scrollSourceRef.current = 'jump'
    editorRef.current?.scrollToLine(line)
    previewRef.current?.scrollToLine(line)
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
    jumpTimerRef.current = setTimeout(() => {
      scrollSourceRef.current = null
    }, 150)
  }, [])
  const handleEditorScrollRatio = useCallback((ratio: number) => {
    if (scrollSourceRef.current === 'preview' || scrollSourceRef.current === 'jump') return
    scrollSourceRef.current = 'editor'
    previewRef.current?.scrollToRatio(ratio)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollSourceRef.current = null
      })
    })
  }, [])
  const handlePreviewScrollRatio = useCallback((ratio: number) => {
    if (scrollSourceRef.current === 'editor' || scrollSourceRef.current === 'jump') return
    scrollSourceRef.current = 'preview'
    editorRef.current?.scrollToRatio(ratio)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollSourceRef.current = null
      })
    })
  }, [])
  const vimMode = useSettingsStore((s) => s.vimMode)
  const vimMouse = useSettingsStore((s) => s.vimMouse)

  const saveTab = useCallback(
    async (tabId: string): Promise<void> => {
      const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId)
      if (!tab || !tab.dirty) return
      const result = await window.api.workspace.saveNote({
        filePath: tab.filePath,
        content: tab.content
      })
      if (result.filePath) {
        markSaved(tabId, result.filePath, tab.content)
      }
    },
    [markSaved]
  )

  const saveActiveTab = useCallback((): void => {
    const id = useTabsStore.getState().activeTabId
    if (id) void saveTab(id)
  }, [saveTab])

  const tabClose = useTabClose(saveTab)
  const { requestQuit } = tabClose

  useEffect(
    () =>
      window.api.window.onCloseRequested(() =>
        requestQuit(() => void window.api.window.confirmClose())
      ),
    [requestQuit]
  )

  useEffect(() => {
    void (async (): Promise<void> => {
      const dir = await window.api.workspace.getRootDir()
      setRootDir(dir)
      const initialTree = await window.api.workspace.getTree()
      setTree(initialTree)
      await useNotePropsStore.getState().load()

      await restoreOpenTabs(new Set(flattenFilePaths(initialTree)))

      const recoverable = await window.api.workspace.listRecoverable()
      if (recoverable.length > 0) setRecoveryItems(recoverable)
      const changelogToShow = await window.api.app.getChangelog()
      if (changelogToShow) setChangelog(changelogToShow)
    })()
  }, [setRootDir, setTree])

  const handleCursorChange = useCallback((pos: { line: number; col: number }): void => {
    useCursorStore.getState().setCursor(pos)
  }, [])

  const resolveNewNoteDir = useCallback(
    (explicitDir?: string): string => {
      if (explicitDir) return explicitDir
      if (selectedFolderPath) return selectedFolderPath
      const tabsState = useTabsStore.getState()
      const tab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
      if (tab?.filePath) return dirOf(tab.filePath)
      return useWorkspaceStore.getState().rootDir ?? ''
    },
    [selectedFolderPath]
  )

  useGlobalShortcuts({
    settingsOpen,
    save: saveActiveTab,
    openSearch: () => setSearchOpen(true),
    newFile: () => {
      setSidebarCollapsed(false)
      sidebarRef.current?.startNewFile(resolveNewNoteDir())
    },
    toggleSettings: () => setSettingsOpen((v) => !v),
    closeSettings: () => setSettingsOpen(false),
    openOrFocusToc: () =>
      setTocOpen((wasOpen) => {
        if (wasOpen) setTocFocusToken((n) => n + 1)
        return true
      }),
    toggleTodo: () => setTodoOpen((v) => !v),
    toggleBacklinks: () => setBacklinksOpen((v) => !v),
    toggleSidebar: () => setSidebarCollapsed(!useSettingsStore.getState().sidebarCollapsed),
    toggleGraph: () => setGraphOpen((v) => !v),
    openDailyNote: () => void openDailyNote(new Date())
  })

  const handleOpenFile = useCallback(
    (filePath: string): void => {
      setSelectedFolderPath(null)
      const openExternally = (): void => {
        void window.api.workspace.openInDefaultApp(filePath).then((error) => {
          if (error) pushToast({ kind: 'info', message: '이 파일을 열 수 있는 앱이 없어요.' })
        })
      }
      const kind = fileKindOf(filePath)
      if (kind === 'external') {
        openExternally()
        return
      }
      if (kind !== 'text') {
        openFile(filePath, '')
        return
      }
      if (useTabsStore.getState().tabs.some((t) => t.filePath === filePath)) {
        openFile(filePath, '')
        return
      }
      void readTextFile(filePath).then((result) => {
        if (result.ok) {
          openFile(filePath, result.content)
          return
        }
        pushToast({
          kind: 'info',
          message:
            result.reason === 'tooLarge'
              ? '20MB가 넘는 파일이라 폴더에서 보여 드려요.'
              : '텍스트로 열 수 없는 파일이라 폴더에서 보여 드려요.'
        })
        void window.api.workspace.reveal(filePath)
      })
    },
    [openFile, pushToast]
  )

  // 템플릿을 지금 노트의 커서 위치에 넣는다
  const handleInsertTemplate = useCallback(
    (template: NoteTemplate): void => {
      const { tabs: allTabs, activeTabId: activeId } = useTabsStore.getState()
      const tab = allTabs.find((t) => t.id === activeId)
      const view = getCurrentView()
      if (!tab?.filePath || !isMarkdownPath(tab.filePath) || !view) {
        pushToast({ kind: 'info', message: '템플릿을 넣을 노트를 먼저 열어 주세요.' })
        return
      }
      const text = applyTemplate(template.content, {
        date: new Date(),
        title: splitName(fileNameOf(tab.filePath)).base,
        dateFormat: useSettingsStore.getState().dailyFormat
      })
      const pos = view.state.selection.main.head
      view.dispatch({
        changes: { from: pos, to: view.state.selection.main.to, insert: text },
        selection: { anchor: pos + text.length },
        scrollIntoView: true
      })
      view.focus()
    },
    [pushToast]
  )

  // 템플릿 이름으로 새 노트를 만든다. 이름이 겹치면 '회의록 2'처럼 번호가 붙는다
  const handleCreateFromTemplate = useCallback(
    async (template: NoteTemplate): Promise<void> => {
      try {
        const created = await window.api.workspace.createNote(
          resolveNewNoteDir(),
          `${template.name}.md`
        )
        setTree(await window.api.workspace.getTree())
        const content = applyTemplate(template.content, {
          date: new Date(),
          title: splitName(fileNameOf(created)).base,
          dateFormat: useSettingsStore.getState().dailyFormat
        })
        await window.api.workspace.saveNote({ filePath: created, content })
        openFile(created, content)
      } catch {
        pushToast({ kind: 'info', message: '템플릿으로 노트를 만들지 못했어요.' })
      }
    },
    [resolveNewNoteDir, openFile, pushToast, setTree]
  )

  // 그날 데일리 노트를 연다. 없으면 템플릿(`템플릿/데일리.md`)으로 새로 만든다
  const openDailyNote = useCallback(
    async (date: Date): Promise<void> => {
      const path = dailyNotePath(date)
      if (!path) return
      const exists = flattenFilePaths(useWorkspaceStore.getState().tree).some(
        (p) => p.toLowerCase() === path.toLowerCase()
      )
      if (exists) {
        handleOpenFile(path)
        return
      }
      const title = splitName(fileNameOf(path)).base
      try {
        const content = buildDailyContent(date, title)
        // 형식에 점이 있어도(2026.10.19) 확장자로 오해하지 않게 .md를 붙여서 넘긴다
        const created = await window.api.workspace.createNote(dirOf(path), `${title}.md`)
        setTree(await window.api.workspace.getTree())
        await window.api.workspace.saveNote({ filePath: created, content })
        openFile(created, content)
      } catch {
        pushToast({ kind: 'info', message: '데일리 노트를 만들지 못했어요. 폴더 설정을 확인해 주세요.' })
      }
    },
    [handleOpenFile, openFile, pushToast, setTree]
  )

  const handleEditorChange = useCallback(
    (tabId: string, value: string): void => {
      setContent(tabId, value)
    },
    [setContent]
  )

  const getNoteIndex = useCallback(() => flattenNotes(useWorkspaceStore.getState().tree), [])

  const getAttachmentDir = useCallback((): string => {
    const tab = useTabsStore
      .getState()
      .tabs.find((t) => t.id === useTabsStore.getState().activeTabId)
    if (!tab) return useWorkspaceStore.getState().rootDir ?? ''
    if (tab.filePath) return dirOf(tab.filePath)
    return useWorkspaceStore.getState().rootDir ?? ''
  }, [])

  const handleMissingTabClick = useCallback(
    (tab: Tab): void => {
      setActiveTab(tab.id)
      pushToast({ kind: 'info', message: '파일이 삭제되었거나 이동되었어요.' })
    },
    [setActiveTab, pushToast]
  )

  const handleEntryRenamed = useCallback(
    (oldPath: string, newPath: string): void => {
      renamePath(oldPath, newPath)
      const oldName = splitName(fileNameOf(oldPath))
      const newName = splitName(fileNameOf(newPath))
      if (oldName.ext.toLowerCase() === '.md' && newName.ext.toLowerCase() === '.md') {
        rewriteWikilinks(oldName.base, newName.base)
      }
      void useNotePropsStore.getState().load()
    },
    [renamePath, rewriteWikilinks]
  )

  const handleEntryMoved = useCallback(
    (oldPath: string, newPath: string): void => {
      renamePath(oldPath, newPath)
      void useNotePropsStore.getState().load()
    },
    [renamePath]
  )

  const handleEntryDeleted = useCallback(
    (path: string): void => {
      const prefix = path + sepOf(path)
      const doomed = useTabsStore.getState().tabs.filter((t) => t.filePath === path || t.filePath?.startsWith(prefix))
      for (const tab of doomed) closeTab(tab.id)
      void useNotePropsStore.getState().load()
    },
    [closeTab]
  )

  const handleOpenDiffFromToast = useCallback(
    (filePath: string, oldContent: string, newContent: string): void => {
      const tab = useTabsStore.getState().tabs.find((t) => t.filePath === filePath)
      if (tab) setActiveTab(tab.id)
      setDiffPopup({
        oldContent,
        newContent,
        oldLabel: '변경 전',
        newLabel: '외부에서 바뀐 내용',
        onApply: () => setDiffPopup(null),
        onRestore: () => {
          if (tab) setContent(tab.id, oldContent)
          setDiffPopup(null)
        }
      })
    },
    [setActiveTab, setContent]
  )

  const handleCompareChanges = useCallback(
    (filePath: string): void => {
      const tab = useTabsStore.getState().tabs.find((t) => t.filePath === filePath)
      if (!tab) return
      void window.api.workspace.readFile(filePath).then((raw) => {
        setDiffPopup({
          oldContent: raw,
          newContent: tab.content,
          oldLabel: '마지막 저장',
          newLabel: '지금 편집 중',
          onApply: () => setDiffPopup(null),
          onRestore: () => {
            setContent(tab.id, raw)
            setDiffPopup(null)
          }
        })
      })
    },
    [setContent]
  )

  const handleOpenBaseDiff = useCallback((): void => {
    const state = useTabsStore.getState()
    const tab = state.tabs.find((t) => t.id === state.activeTabId)
    if (!tab) return
    const base = tab.baseContent
    setDiffPopup({
      oldContent: base,
      newContent: tab.content,
      oldLabel: '탭을 열었을 때',
      newLabel: '지금 편집 중',
      onApply: () => setDiffPopup(null),
      onRestore: () => {
        setContent(tab.id, base)
        setDiffPopup(null)
      }
    })
  }, [setContent])

  const handleOpenHistory = useCallback((filePath: string): void => {
    const tab = useTabsStore.getState().tabs.find((t) => t.filePath === filePath)
    if (tab) {
      setHistoryTarget({ filePath, content: tab.content })
      return
    }
    void window.api.workspace.readFile(filePath).then((content) => {
      setHistoryTarget({ filePath, content })
    })
  }, [])

  const handleRestoreHistory = useCallback(
    (snapshot: string): void => {
      if (!historyTarget) return
      const { filePath, content } = historyTarget
      openFile(filePath, content)
      const tab = useTabsStore.getState().tabs.find((t) => t.filePath === filePath)
      if (tab) setContent(tab.id, snapshot)
      setHistoryTarget(null)
      pushToast({
        kind: 'info',
        message: '이전 버전으로 되돌렸어요.'
      })
    },
    [historyTarget, openFile, setContent, pushToast]
  )
  const handleLinkClick = useCallback(
    (href: string): void => {
      let rel = href.split('#')[0].split('?')[0]
      try {
        rel = decodeURIComponent(rel)
      } catch {
      }
      if (!rel) return
      const base = getAttachmentDir()
      const sep = base.includes('\\') ? '\\' : '/'
      const lead = base.startsWith('/') ? '/' : ''
      const out: string[] = []
      for (const p of `${base}/${rel}`.split(/[\\/]/)) {
        if (p === '..') out.pop()
        else if (p !== '.' && p !== '') out.push(p)
      }
      handleOpenFile(lead + out.join(sep))
    },
    [getAttachmentDir, handleOpenFile]
  )

  const handleOpenTodo = useCallback(
    (filePath: string, line: number): void => {
      setTodoOpen(false)
      const target = resolveNotePath(filePath)
      const jump = (): void => {
        setTimeout(() => jumpToLine(line), 80)
      }
      const existing = useTabsStore.getState().tabs.find((t) => t.filePath === target)
      if (existing) {
        setActiveTab(existing.id)
        jump()
        return
      }
      void window.api.workspace.readFile(target).then((content) => {
        openFile(target, content)
        jump()
      })
    },
    [setActiveTab, openFile, jumpToLine]
  )

  const handleWikilinkClick = useCallback(
    (title: string, heading: string | null): void => {
      // `[[#제목]]`은 지금 보고 있는 노트를 가리킨다
      const targetPath = title
        ? flattenNotes(useWorkspaceStore.getState().tree).find((n) => n.title === title)?.path
        : (useTabsStore.getState().tabs.find((t) => t.id === useTabsStore.getState().activeTabId)
            ?.filePath ?? undefined)
      if (!targetPath) {
        pushToast({ kind: 'info', message: `"${title}" 파일을 찾을 수 없어요.` })
        return
      }
      if (!heading) {
        handleOpenFile(targetPath)
        return
      }
      const openTab = useTabsStore.getState().tabs.find((t) => t.filePath === targetPath)
      const loadContent = openTab
        ? Promise.resolve(openTab.content)
        : window.api.workspace.readFile(targetPath)
      void loadContent.then((content) => {
        const line = findHeadingLine(content, heading)
        if (line === null) {
          handleOpenFile(targetPath)
          pushToast({ kind: 'info', message: `'${heading}' 제목을 찾을 수 없어요.` })
          return
        }
        handleOpenTodo(targetPath, line)
      })
    },
    [handleOpenFile, handleOpenTodo, pushToast]
  )

  const handleToggleTask = useCallback(
    (line: number): void => {
      const state = useTabsStore.getState()
      const tab = state.tabs.find((t) => t.id === state.activeTabId)
      if (!tab) return
      const next = toggleTaskAtLine(tab.content, line)
      if (next !== null) setContent(tab.id, next)
    },
    [setContent]
  )

  const handleReplaceSource = useCallback(
    (next: string): void => {
      const state = useTabsStore.getState()
      const tab = state.tabs.find((t) => t.id === state.activeTabId)
      if (!tab) return
      setContent(tab.id, next)
    },
    [setContent]
  )

  const handleToggleTodo = useCallback(
    async (filePath: string, line: number): Promise<void> => {
      const target = resolveNotePath(filePath)
      const tab = useTabsStore.getState().tabs.find((t) => t.filePath === target)
      if (tab) {
        const next = toggleTaskAtLine(tab.content, line - 1)
        if (next !== null) setContent(tab.id, next)
        return
      }
      const raw = await window.api.workspace.readFile(target)
      const next = toggleTaskAtLine(raw, line - 1)
      if (next === null) return
      await window.api.workspace.saveNote({
        filePath: target,
        content: next
      })
    },
    [setContent]
  )

  const getTodoOverrides = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const t of useTabsStore.getState().tabs) {
      if (t.filePath) out[t.filePath] = t.content
    }
    return out
  }, [])

  const tocEntries = useMemo(() => extractToc(activeTab?.content ?? ''), [activeTab?.content])
  const handleTocJump = useCallback(
    (line: number) => {
      jumpToLine(line)
    },
    [jumpToLine]
  )
  const handleTocReturnFocus = useCallback(() => {
    editorRef.current?.focus()
  }, [])

  const dirtyFilePaths = useMemo(
    () => tabs.filter((t) => t.dirty && t.filePath).map((t) => t.filePath as string),
    [tabs]
  )

  // 탭 줄은 타이틀바가 아니라 본문 카드 머리 줄에 둔다
  const tabBar = (
    <TabBar
      tabs={tabs}
      activeTabId={activeTabId}
      onSelect={setActiveTab}
      onClose={tabClose.requestClose}
      onCloseAll={tabClose.closeAll}
      onMissingClick={handleMissingTabClick}
    />
  )

  return (
    <div className="flex h-full flex-col bg-bg-soft text-text">
      <TitleBar
        center={
          activeTab && activeTab.kind === 'text' && showPreview ? (
            <ViewModeSwitch
              value={viewMode}
              onChange={(next) => {
                setAnimating(true)
                setViewMode(next)
              }}
            />
          ) : null
        }
        left={
          // 아래 묶음(아이콘 줄 + 사이드바 + 오른쪽 테두리 1) + 본문 앞 틈 4와 같은 폭이라,
          // 탭이 에디터 카드 왼쪽 끝에서 시작한다. 접기 버튼은 아이콘 줄 위 가운데, 검색창은 사이드바 바로 위에 같은 폭으로
          <motion.div
            className="flex shrink-0 items-center overflow-hidden"
            initial={false}
            animate={{ width: ACTIVITY_BAR_WIDTH + (sidebarCollapsed ? 0 : sidebar.width) + 1 + 4 }}
            transition={{ duration: sidebar.resizing ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex shrink-0 justify-center" style={{ width: ACTIVITY_BAR_WIDTH }}>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              onDoubleClick={(e) => e.stopPropagation()}
              title={`사이드바 ${sidebarCollapsed ? '펼치기' : '접기'} (Ctrl+Shift+E)`}
              className={`titlebar-no-drag shrink-0 ${TITLE_BTN}`}
            >
              <SidebarIcon />
            </button>
            </div>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                onDoubleClick={(e) => e.stopPropagation()}
                title="검색 (Ctrl+P)"
                style={{ width: sidebar.width }}
                className="titlebar-no-drag flex h-6 shrink-0 items-center gap-1.5 rounded-md bg-bg-mute px-2 text-[12px] text-text-tertiary outline-none transition-colors hover:text-text-secondary"
              >
                <SearchIcon width={14} height={14} className="shrink-0" />
                검색
              </button>
            )}
          </motion.div>
        }
      />
      <main className="flex min-h-0 flex-1">
        {/* 아이콘 줄과 사이드바를 한 테두리로 묶는다. 사이드바를 접으면 아이콘 줄만 남는다 */}
        <div className="flex shrink-0 rounded-r-xl border-y border-r border-border">
        <ActivityBar
          onOpenSearch={() => setSearchOpen(true)}
          onOpenDaily={() => void openDailyNote(new Date())}
          onOpenTodo={() => setTodoOpen((v) => !v)}
          onOpenBacklinks={() => setBacklinksOpen((v) => !v)}
          onOpenGraph={() => setGraphOpen((v) => !v)}
          onOpenSettings={() => setSettingsOpen((v) => !v)}
        />
        <motion.div
          className="relative shrink-0"
          initial={false}
          animate={{ width: sidebarCollapsed ? 0 : sidebar.width }}
          transition={{ duration: sidebar.resizing ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <div
            className={`h-full overflow-hidden ${sidebarCollapsed ? '' : 'border-l border-border'}`}
            inert={sidebarCollapsed}
          >
            <div className="h-full" style={{ width: sidebar.width }}>
              <Sidebar
                ref={sidebarRef}
                tree={tree}
                rootDir={rootDir}
                activeFilePath={activeTab?.filePath ?? null}
                onOpenFile={handleOpenFile}
                onFileCreated={handleOpenFile}
                onEntryRenamed={handleEntryRenamed}
                onEntryMoved={handleEntryMoved}
                onEntryDeleted={handleEntryDeleted}
                onFocusEditor={() => requestAnimationFrame(() => editorRef.current?.focus())}
                dirtyFilePaths={dirtyFilePaths}
                onCompareChanges={handleCompareChanges}
                onOpenHistory={handleOpenHistory}
                onOpenAtLine={handleOpenTodo}
                selectedFolderPath={selectedFolderPath}
                onSelectFolder={setSelectedFolderPath}
                dailyFocusDate={activeDailyDate}
                onInsertTemplate={handleInsertTemplate}
                onCreateFromTemplate={(t) => void handleCreateFromTemplate(t)}
                className="h-full"
              />
            </div>
        </div>
        {!sidebarCollapsed && (
          <div
            onMouseDown={sidebar.onResizeStart}
            className="group absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent" />
          </div>
        )}
      </motion.div>
        </div>
        {/* 본문은 카드로 그린다. 에디터와 미리보기는 각각 카드이고, 양옆에 4px 틈을 둔다 */}
        <div className="mx-1 flex min-w-0 flex-1 flex-col">
          {activeTab && activeTab.kind !== 'text' && activeTab.filePath ? (
            <div className={`flex min-h-0 flex-1 flex-col overflow-clip ${CARD}`}>
              <EditorHeader>{tabBar}</EditorHeader>
              <FileViewer key={activeTab.id} filePath={activeTab.filePath} kind={activeTab.kind} />
            </div>
          ) : activeTab ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={setSplitBox} className="flex min-h-0 flex-1">
                {/* 미리보기만 볼 때도 에디터는 폭만 0으로 줄인다(편집 상태와 되돌리기 기록을 지키기 위해) */}
                <motion.div
                  initial={false}
                  animate={{
                    width: editorW,
                    minWidth: splitMode ? EDITOR_MIN_WIDTH : 0,
                    opacity: previewOnly ? 0 : 1,
                    borderWidth: previewOnly ? 0 : 1
                  }}
                  transition={widthTransition}
                  inert={previewOnly}
                  className={`relative flex min-w-0 shrink-0 flex-col overflow-clip ${CARD}`}
                >
                  <div
                    className="flex min-h-0 flex-1 flex-col"
                    style={{ width: editorContentW || undefined, minWidth: editorContentW || undefined }}
                  >
                  <EditorHeader
                    right={
                      tagBarPath && (
                        <TagBar filePath={tagBarPath} menuDirection="down" />
                      )
                    }
                  >
                    {tabBar}
                  </EditorHeader>
                  <MarkdownEditor
                    ref={editorRef}
                    tabId={activeTab.id}
                    filePath={activeTab.filePath}
                    value={activeTab.content}
                    onChange={handleEditorChange}
                    getNoteIndex={getNoteIndex}
                    getAttachmentDir={getAttachmentDir}
                    vimMode={vimMode}
                    vimMouse={vimMouse}
                    baseContent={activeTab.baseContent}
                    onOpenBaseDiff={handleOpenBaseDiff}
                    onSave={saveActiveTab}
                    onCursorChange={handleCursorChange}
                    onScrollRatio={handleEditorScrollRatio}
                    className="min-h-0 min-w-0 flex-1 overflow-auto"
                  />
                  </div>
                </motion.div>
                {showPreview && (
                  <motion.div
                    initial={false}
                    animate={{ width: gapW }}
                    transition={widthTransition}
                    className="shrink-0"
                  />
                )}
                <AnimatePresence initial={false}>
                {showPreviewPane && (
                  <motion.div
                    key="preview-card"
                    initial={{ width: 0, opacity: 0, borderWidth: 0 }}
                    animate={{ width: previewW, opacity: 1, borderWidth: 1 }}
                    exit={{ width: 0, opacity: 0, borderWidth: 0, transition: VIEW_TRANSITION }}
                    transition={widthTransition}
                    className={`flex min-w-0 shrink-0 flex-col overflow-clip ${CARD}`}
                  >
                  <div
                    className="flex min-h-0 flex-1 flex-col"
                    style={{ width: previewW || undefined, minWidth: previewW || undefined }}
                  >
                  {/* 에디터 머리 줄과 같은 높이·선 */}
                  <div className="flex h-8 shrink-0 items-center border-b border-border pl-3 pr-2 text-[12px] text-text-tertiary">
                    미리보기
                    {/* 데일리 노트를 열었을 때만 이전·오늘·다음 이동 */}
                    {activeDailyDate && (
                      <div className="ml-auto">
                        <DailyNav
                          date={activeDailyDate}
                          onOpenFile={handleOpenFile}
                          onOpenToday={() => void openDailyNote(new Date())}
                        />
                      </div>
                    )}
                  </div>
                  <MarkdownPreview
                    ref={previewRef}
                    source={activeTab.content}
                    baseDir={getAttachmentDir()}
                    onScrollRatio={handlePreviewScrollRatio}
                    onWikilinkClick={handleWikilinkClick}
                    onToggleTask={handleToggleTask}
                    onLinkClick={handleLinkClick}
                    onReplaceSource={handleReplaceSource}
                    onMinWidthChange={setPreviewMinWidth}
                    className="min-h-0 flex-1 overflow-auto px-[var(--preview-pad)] pb-6 pt-7"
                    docKey={activeTab.id}
                  />
                  </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className={`flex min-h-0 flex-1 flex-col overflow-clip ${CARD}`}>
              <EmptyState />
            </div>
          )}
        </div>
      </main>
      <StatusBar tab={activeTab} isViewer={isViewer} />
      <AnimatePresence>
        {searchOpen && (
          <SearchPanel
            key="search-panel"
            rootDir={rootDir}
            onOpenFile={handleOpenFile}
            onClose={() => setSearchOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {settingsOpen && (
          <SettingsPanel key="settings-panel" onClose={() => setSettingsOpen(false)} />
        )}
      </AnimatePresence>
      <ToastStack onOpenDiff={handleOpenDiffFromToast} />
      {diffPopup && (
        <DiffView
          oldContent={diffPopup.oldContent}
          newContent={diffPopup.newContent}
          oldLabel={diffPopup.oldLabel}
          newLabel={diffPopup.newLabel}
          onApply={diffPopup.onApply}
          onRestore={diffPopup.onRestore}
          onClose={() => setDiffPopup(null)}
        />
      )}
      {historyTarget && (
        <HistoryDialog
          filePath={historyTarget.filePath}
          currentContent={historyTarget.content}
          onRestore={handleRestoreHistory}
          onClose={() => setHistoryTarget(null)}
        />
      )}
      {recoveryItems && (
        <RecoveryDialog items={recoveryItems} onDone={() => setRecoveryItems(null)} />
      )}
      {changelog && <ChangelogDialog content={changelog} onClose={() => setChangelog(null)} />}
      {tabClose.closeConfirm && (
        <SaveChangesDialog
          title={tabClose.closeConfirm.title}
          onSave={tabClose.confirmSave}
          onDiscard={tabClose.confirmDiscard}
          onCancel={tabClose.cancelClose}
        />
      )}
      {tocOpen && activeTab && !isViewer && (
        <TocPanel
          entries={tocEntries}
          onJump={handleTocJump}
          onClose={() => setTocOpen(false)}
          focusToken={tocFocusToken}
          onReturnFocus={handleTocReturnFocus}
        />
      )}
      <AnimatePresence>
        {todoOpen && (
          <TodoDialog
            key="todo-dialog"
            onOpen={handleOpenTodo}
            onToggle={handleToggleTodo}
            getOverrides={getTodoOverrides}
            onClose={() => setTodoOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {graphOpen && (
          <GraphDialog
            key="graph-dialog"
            activePath={activeTab?.filePath ?? null}
            onOpen={(filePath) => {
              setGraphOpen(false)
              handleOpenFile(filePath)
            }}
            onClose={() => setGraphOpen(false)}
            />
        )}
      </AnimatePresence>
      {backlinksOpen && activeTab && !isViewer && (
        <BacklinksPanel
          filePath={activeTab.filePath}
          onOpen={handleOpenTodo}
          onClose={() => setBacklinksOpen(false)}
        />
      )}
    </div>
  )
}

export default App