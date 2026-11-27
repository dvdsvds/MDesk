import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SHORTCUTS, type ShortcutAction, type ShortcutMap } from '../utils/shortcuts'
import { DEFAULT_TEMPLATES, type NoteTemplate } from '../utils/noteTemplate'
import { DEFAULT_EDITOR_FONT_FAMILY, PREVIOUS_EDITOR_FONT_FAMILY } from '../utils/editorFonts'

const REMOVED_DEFAULT_TEMPLATE_IDS = ['daily', 'meeting', 'weekly']

import { osDefaultTheme, type ThemePreference } from '../utils/themes'

export type { ThemePreference }

export type ViewMode = 'editor' | 'split' | 'preview'

const OLD_EDITOR_FONT_FAMILY = "'IBM Plex Mono', 'D2Coding', Pretendard, monospace"
const DEFAULT_EDITOR_FONT_SIZE = 13.5
const DEFAULT_EDITOR_LINE_HEIGHT = 1.4

interface SettingsState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  themeChosen: boolean
  setThemeChosen: (value: boolean) => void
  vimMode: boolean
  setVimMode: (value: boolean) => void
  h1Warning: boolean
  setH1Warning: (value: boolean) => void
  showToolbar: boolean
  setShowToolbar: (value: boolean) => void
  showEditorImages: boolean
  setShowEditorImages: (value: boolean) => void
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
  githubSectionOpen: boolean
  setGithubSectionOpen: (value: boolean) => void
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
      showEditorImages: true,
      setShowEditorImages: (value) => set({ showEditorImages: value }),
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
      githubSectionOpen: true,
      setGithubSectionOpen: (value) => set({ githubSectionOpen: value }),
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
          const old = s as Record<string, unknown>
          delete old.propertyDefs
          delete old.propertyOptions
          delete old.tagGroupBy
          const groups = old.tagCollapsedGroups as { status?: string[] } | undefined
          s.tagCollapsedGroups = Array.isArray(groups?.status) ? groups.status : []
        }
        if (version < 9) {
          if (s.editorLineHeight === 1.8) s.editorLineHeight = DEFAULT_EDITOR_LINE_HEIGHT
        }
        if (version < 10) {
          if (s.editorFontFamily === PREVIOUS_EDITOR_FONT_FAMILY) {
            s.editorFontFamily = DEFAULT_EDITOR_FONT_FAMILY
          }
        }
        if (version < 11) {
          const old = s as Record<string, unknown>
          if (old.theme === 'light') s.theme = 'paper-light'
          else if (old.theme === 'dark') s.theme = 'paper-dark'
          else s.theme = osDefaultTheme()
          s.themeChosen = true
        }
        if (version < 12) {
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
