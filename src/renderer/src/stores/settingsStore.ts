import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SHORTCUTS, type ShortcutAction, type ShortcutMap } from '../utils/shortcuts'
import { DEFAULT_TEMPLATES, type NoteTemplate } from '../utils/noteTemplate'
import { DEFAULT_EDITOR_FONT_FAMILY, PREVIOUS_EDITOR_FONT_FAMILY } from '../utils/editorFonts'

/** 예전에 기본으로 들어 있던 템플릿(지금은 기본 템플릿이 없어서 저장돼 있어도 없앤다) */
const REMOVED_DEFAULT_TEMPLATE_IDS = ['daily', 'meeting', 'weekly']

import { osDefaultTheme, type ThemePreference } from '../utils/themes'

export type { ThemePreference }

/** 본문 보기: 에디터만 / 에디터와 미리보기 나란히 / 미리보기만 */
export type ViewMode = 'editor' | 'split' | 'preview'

const OLD_EDITOR_FONT_FAMILY = "'IBM Plex Mono', 'D2Coding', Pretendard, monospace"
const DEFAULT_EDITOR_FONT_SIZE = 13.5
const DEFAULT_EDITOR_LINE_HEIGHT = 1.4

interface SettingsState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  /** 처음 실행 때 테마를 한 번 골랐는지. 골랐거나 예전 설정이 있으면 다시 묻지 않는다 */
  themeChosen: boolean
  setThemeChosen: (value: boolean) => void
  vimMode: boolean
  setVimMode: (value: boolean) => void
  h1Warning: boolean
  setH1Warning: (value: boolean) => void
  showToolbar: boolean
  setShowToolbar: (value: boolean) => void
  editorFontFamily: string
  editorFontSize: number
  editorLineHeight: number
  setEditorFont: (partial: Partial<{ family: string; size: number; lineHeight: number }>) => void
  resetFonts: () => void
  resetEditorFont: () => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  uiZoom: number
  setUiZoom: (value: number) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (value: boolean) => void
  filesSectionOpen: boolean
  setFilesSectionOpen: (value: boolean) => void
  driveSectionOpen: boolean
  setDriveSectionOpen: (value: boolean) => void
  /** 고친 뒤 잠시 멈추면 저절로 저장한다 */
  autoSave: boolean
  setAutoSave: (value: boolean) => void
  tagsSectionOpen: boolean
  setTagsSectionOpen: (value: boolean) => void
  collapsedFolders: string[]
  setFolderCollapsed: (path: string, collapsed: boolean) => void
  templates: NoteTemplate[]
  saveTemplate: (template: NoteTemplate) => void
  deleteTemplate: (id: string) => void
  templatesSectionOpen: boolean
  setTemplatesSectionOpen: (value: boolean) => void
  /** 사이드바 태그 섹션에서 접어 둔 상태 값 */
  tagCollapsedGroups: string[]
  toggleTagGroup: (label: string) => void
  shortcuts: ShortcutMap
  setShortcut: (action: ShortcutAction, combo: string) => void
  resetShortcut: (action: ShortcutAction) => void
  resetAllShortcuts: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: osDefaultTheme(),
      setTheme: (theme) => set({ theme }),
      themeChosen: false,
      setThemeChosen: (value) => set({ themeChosen: value }),
      vimMode: false,
      setVimMode: (value) => set({ vimMode: value }),
      h1Warning: true,
      setH1Warning: (value) => set({ h1Warning: value }),
      showToolbar: false,
      setShowToolbar: (value) => set({ showToolbar: value }),
      editorFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
      editorLineHeight: DEFAULT_EDITOR_LINE_HEIGHT,
      setEditorFont: (partial) =>
        set((state) => ({
          editorFontFamily: partial.family ?? state.editorFontFamily,
          editorFontSize: partial.size ?? state.editorFontSize,
          editorLineHeight: partial.lineHeight ?? state.editorLineHeight
        })),
      resetFonts: () =>
        set({
          editorFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
          editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
          editorLineHeight: DEFAULT_EDITOR_LINE_HEIGHT
        }),
      resetEditorFont: () =>
        set({
          editorFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
          editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
          editorLineHeight: DEFAULT_EDITOR_LINE_HEIGHT
        }),
      viewMode: 'split',
      setViewMode: (mode) => set({ viewMode: mode }),
      uiZoom: 100,
      setUiZoom: (value) =>
        set({ uiZoom: Math.min(200, Math.max(50, Math.round(value / 10) * 10)) }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      filesSectionOpen: true,
      setFilesSectionOpen: (value) => set({ filesSectionOpen: value }),
      driveSectionOpen: true,
      setDriveSectionOpen: (value) => set({ driveSectionOpen: value }),
      autoSave: false,
      setAutoSave: (value) => set({ autoSave: value }),
      tagsSectionOpen: false,
      setTagsSectionOpen: (value) => set({ tagsSectionOpen: value }),
      templates: DEFAULT_TEMPLATES,
      saveTemplate: (template) =>
        set((state) => ({
          templates: state.templates.some((t) => t.id === template.id)
            ? state.templates.map((t) => (t.id === template.id ? template : t))
            : [...state.templates, template]
        })),
      deleteTemplate: (id) =>
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),
      templatesSectionOpen: false,
      setTemplatesSectionOpen: (value) => set({ templatesSectionOpen: value }),
      collapsedFolders: [],
      setFolderCollapsed: (path, collapsed) =>
        set((state) => {
          const has = state.collapsedFolders.includes(path)
          if (has === collapsed) return state
          return {
            collapsedFolders: collapsed
              ? [...state.collapsedFolders, path]
              : state.collapsedFolders.filter((p) => p !== path)
          }
        }),
      tagCollapsedGroups: [],
      toggleTagGroup: (label) =>
        set((state) => ({
          tagCollapsedGroups: state.tagCollapsedGroups.includes(label)
            ? state.tagCollapsedGroups.filter((l) => l !== label)
            : [...state.tagCollapsedGroups, label]
        })),
      shortcuts: DEFAULT_SHORTCUTS,
      setShortcut: (action, combo) =>
        set((state) => ({ shortcuts: { ...state.shortcuts, [action]: combo } })),
      resetShortcut: (action) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [action]: DEFAULT_SHORTCUTS[action] }
        })),
      resetAllShortcuts: () => set({ shortcuts: DEFAULT_SHORTCUTS })
    }),
    {
      name: 'mdesk-settings',
      // 5·6은 되돌린 속성 확장 작업이 쓰던 버전. 8부터 속성은 상태 하나(값 고정)뿐이다
      version: 13,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>
        return {
          ...current,
          ...p,
          shortcuts: { ...DEFAULT_SHORTCUTS, ...(p.shortcuts ?? {}) },
          templates: (p.templates ?? current.templates).filter(
            (t) => !REMOVED_DEFAULT_TEMPLATE_IDS.includes(t.id)
          )
        }
      },
      migrate: (persisted, version) => {
        const s = persisted as Partial<SettingsState>
        if (version < 1) {
          if (s.editorFontFamily === OLD_EDITOR_FONT_FAMILY) {
            s.editorFontFamily = DEFAULT_EDITOR_FONT_FAMILY
          }
          if (s.editorFontSize === 12 || s.editorFontSize === 14) {
            s.editorFontSize = DEFAULT_EDITOR_FONT_SIZE
          }
          if (s.editorLineHeight === 1.6) s.editorLineHeight = DEFAULT_EDITOR_LINE_HEIGHT
        }
        if (version < 3) {
          s.showToolbar = false
        }
        if (version < 8) {
          // 세부·중요도와 값 목록 편집을 없앴다. 예전에 저장한 설정 값은 버린다
          const old = s as Record<string, unknown>
          delete old.propertyDefs
          delete old.propertyOptions
          delete old.tagGroupBy
          const groups = old.tagCollapsedGroups as { status?: string[] } | undefined
          s.tagCollapsedGroups = Array.isArray(groups?.status) ? groups.status : []
        }
        if (version < 9) {
          // 에디터 줄 간격 기본값을 1.8에서 1.4로 낮췄다. 예전 기본값 그대로 쓰던 경우만 옮긴다
          if (s.editorLineHeight === 1.8) s.editorLineHeight = DEFAULT_EDITOR_LINE_HEIGHT
        }
        if (version < 10) {
          // 에디터 기본 글꼴을 한글이 영문의 정확히 2배 폭인 Monoplex KR로 바꿨다. 예전 기본값 그대로 쓰던 경우만 옮긴다
          if (s.editorFontFamily === PREVIOUS_EDITOR_FONT_FAMILY) {
            s.editorFontFamily = DEFAULT_EDITOR_FONT_FAMILY
          }
        }
        if (version < 11) {
          // 색 테마를 이름 있는 목록에서 고르게 바꿨다. 예전 밝게·어둡게는 Paper Light·Paper Dark로 옮기고,
          // 시스템은 지금 OS 설정에 맞는 쪽으로 정한다. 이미 쓰던 사용자에게는 선택 창을 보이지 않는다
          // (테마 선택 창은 새로 설치해서 처음 실행할 때만 뜬다)
          const old = s as Record<string, unknown>
          if (old.theme === 'light') s.theme = 'paper-light'
          else if (old.theme === 'dark') s.theme = 'paper-dark'
          else s.theme = osDefaultTheme()
          s.themeChosen = true
        }
        if (version < 12) {
          // 보기 전환 기본 단축키를 Ctrl+Alt+I/O/P에서 Alt+I/O/P로 줄였다. 예전 기본값 그대로 쓰던 것만 옮기고,
          // 직접 바꿔 둔 키는 건드리지 않는다
          const saved = (s.shortcuts ?? {}) as Record<string, string>
          const moved: Record<string, [string, string]> = {
            viewEditor: ['Ctrl+Alt+I', 'Alt+I'],
            viewSplit: ['Ctrl+Alt+O', 'Alt+O'],
            viewPreview: ['Ctrl+Alt+P', 'Alt+P'],
            nextTab: ['Ctrl+Tab', 'Alt+.'],
            prevTab: ['Ctrl+Shift+Tab', 'Alt+,']
          }
          for (const [action, [from, to]] of Object.entries(moved)) {
            if (saved[action] === from) saved[action] = to
          }
          s.shortcuts = saved as unknown as ShortcutMap
        }
        if (version < 13) {
          // 3단 화면으로 바꾸면서 태그·템플릿 섹션은 닫힌 상태로 시작한다
          s.tagsSectionOpen = false
          s.templatesSectionOpen = false
          s.filesSectionOpen = true
          s.driveSectionOpen = true
        }
        return s as SettingsState
      }
    }
  )
)
