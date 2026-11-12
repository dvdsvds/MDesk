import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastStore } from '../../stores/toastStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { ShortcutRow } from './ShortcutRow'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { SHORTCUT_LABELS, type ShortcutAction } from '../../utils/shortcuts'
import { ThemeSelect } from './ThemeSelect'
import { ThemePreviewCard } from './ThemePreview'
import { INPUT, NumberField, Row, Toggle } from './SettingsParts'
import { TrashSetting } from './TrashSetting'
import { FontSelect } from './FontSelect'
import { AboutSetting } from './AboutSetting'

/** 설정의 단축키를 하는 일 기준으로 나눈 소제목. 비교 화면의 적용·되돌리기는 키를 바꿀 수 없는 고정 단축키라 여기에 없다 */
const SHORTCUT_GROUPS: { group: string; actions: ShortcutAction[] }[] = [
  { group: '파일', actions: ['newNote', 'save', 'copyPathAbsolute', 'copyPathRelative'] },
  {
    group: '사이드바',
    actions: ['toggleSidebar', 'renameItem', 'newFolder', 'revealItem', 'exportItem']
  },
  {
    group: '보기',
    actions: ['viewEditor', 'viewSplit', 'viewPreview', 'zoomIn', 'zoomOut', 'zoomReset']
  },
  {
    group: '열기',
    actions: ['search', 'todoDashboard', 'graph', 'toggleToc', 'backlinks', 'toggleSettings']
  }
]

export const CATEGORIES = ['일반', '화면', '단축키', '정보'] as const
export type Category = (typeof CATEGORIES)[number]

export interface SettingItem {
  id: string
  category: Category
  group?: string
  label: string
  render: () => React.ReactNode
}

export function useSettingItems(): SettingItem[] {
  const vimMode = useSettingsStore((s) => s.vimMode)
  const showToolbar = useSettingsStore((s) => s.showToolbar)
  const setShowToolbar = useSettingsStore((s) => s.setShowToolbar)
  const setVimMode = useSettingsStore((s) => s.setVimMode)
  const vimMouse = useSettingsStore((s) => s.vimMouse)
  const setVimMouse = useSettingsStore((s) => s.setVimMouse)
  const editorFontFamily = useSettingsStore((s) => s.editorFontFamily)
  const editorFontSize = useSettingsStore((s) => s.editorFontSize)
  const editorLineHeight = useSettingsStore((s) => s.editorLineHeight)
  const setEditorFont = useSettingsStore((s) => s.setEditorFont)
  const previewFontFamily = useSettingsStore((s) => s.previewFontFamily)
  const previewFontSize = useSettingsStore((s) => s.previewFontSize)
  const previewLineHeight = useSettingsStore((s) => s.previewLineHeight)
  const setPreviewFont = useSettingsStore((s) => s.setPreviewFont)

  const pushToast = useToastStore((s) => s.push)
  const [historyDir, setHistoryDir] = useState('')

  useEffect(() => {
    void window.api.workspace.getHistoryDir().then(setHistoryDir)
  }, [])

  const applyHistoryDir = useCallback(
    async (dir: string | null): Promise<void> => {
      const result = await window.api.workspace.setHistoryDir(dir)
      if (result.ok) {
        setHistoryDir(result.path)
        pushToast({ kind: 'info', message: '버전 기록을 새 위치로 옮겼어요.' })
      } else {
        pushToast({ kind: 'info', message: result.error })
      }
    },
    [pushToast]
  )

  const handleChangeHistoryDir = useCallback(async (): Promise<void> => {
    const picked = await window.api.workspace.pickFolder()
    if (picked) await applyHistoryDir(picked)
  }, [applyHistoryDir])

  const handleResetHistoryDir = useCallback((): void => {
    void applyHistoryDir(null)
  }, [applyHistoryDir])

  return useMemo(
    () => [
      {
        id: 'show-toolbar',
        category: '일반',
        group: '에디터',
        label: '서식 툴바',
        render: () => (
          <Row label="서식 툴바">
            <Toggle checked={showToolbar} onChange={() => setShowToolbar(!showToolbar)} />
          </Row>
        )
      },
      {
        id: 'vim-mode',
        category: '일반',
        group: 'Vim',
        label: 'Vim 모드',
        render: () => (
          <Row label="Vim 모드">
            <Toggle checked={vimMode} onChange={() => setVimMode(!vimMode)} />
          </Row>
        )
      },
      {
        id: 'vim-mouse',
        category: '일반',
        group: 'Vim',
        label: '마우스 사용',
        render: () => (
          <Row label="마우스 사용">
            <Toggle checked={vimMouse} onChange={() => setVimMouse(!vimMouse)} />
          </Row>
        )
      },
      {
        id: 'history-dir',
        category: '일반',
        group: '버전 기록',
        label: '기록 저장 위치',
        render: () => (
          <div className="px-3.5 py-3">
            <div className="text-[13.5px] text-text">기록 저장 위치</div>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-text/[0.07] px-2.5">
                <FileTypeIcon name="" kind="folder" size={16} />
                <span
                  className="min-w-0 flex-1 truncate text-[12.5px] text-text-secondary"
                  title={historyDir}
                >
                  {historyDir || '…'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleChangeHistoryDir}
                className="h-8 shrink-0 rounded-lg bg-accent-soft px-3 text-[13px] font-medium text-accent outline-none transition-[filter] hover:brightness-110"
              >
                폴더 변경
              </button>
              <button
                type="button"
                onClick={handleResetHistoryDir}
                className="h-8 shrink-0 rounded-lg px-2.5 text-[13px] text-text-secondary outline-none transition-colors hover:bg-bg-mute hover:text-text"
              >
                기본값으로
              </button>
            </div>
          </div>
        )
      },
      {
        id: 'trash',
        category: '일반',
        group: '휴지통',
        label: '앱 휴지통',
        render: () => <TrashSetting />
      },
      {
        id: 'theme-preview',
        category: '화면',
        group: '테마',
        label: '테마 미리보기',
        render: () => <ThemePreviewCard />
      },
      {
        id: 'theme',
        category: '화면',
        label: '테마',
        render: () => (
          <div className="p-3">
            <ThemeSelect />
          </div>
        )
      },
      {
        id: 'editor-font-family',
        category: '화면',
        group: '에디터',
        label: '글꼴',
        render: () => (
          <Row label="글꼴">
            <FontSelect value={editorFontFamily} onChange={(family) => setEditorFont({ family })} />
          </Row>
        )
      },
      {
        id: 'editor-font-size',
        category: '화면',
        group: '에디터',
        label: '글꼴 크기',
        render: () => (
          <Row label="글꼴 크기">
            <NumberField
              value={editorFontSize}
              min={8}
              max={40}
              onChange={(v) => setEditorFont({ size: v })}
            />
          </Row>
        )
      },
      {
        id: 'editor-line-height',
        category: '화면',
        group: '에디터',
        label: '줄 간격',
        render: () => (
          <Row label="줄 간격">
            <NumberField
              value={editorLineHeight}
              step={0.1}
              min={1}
              max={3}
              onChange={(v) => setEditorFont({ lineHeight: v })}
            />
          </Row>
        )
      },
      {
        id: 'preview-font-family',
        category: '화면',
        group: '프리뷰',
        label: '글꼴',
        render: () => (
          <Row label="글꼴">
            <input
              value={previewFontFamily}
              onChange={(e) => setPreviewFont({ family: e.target.value })}
              className={`${INPUT} w-64 text-[12.5px] text-text-secondary focus:text-text`}
            />
          </Row>
        )
      },
      {
        id: 'preview-font-size',
        category: '화면',
        group: '프리뷰',
        label: '글꼴 크기',
        render: () => (
          <Row label="글꼴 크기">
            <NumberField
              value={previewFontSize}
              min={8}
              max={40}
              onChange={(v) => setPreviewFont({ size: v })}
            />
          </Row>
        )
      },
      {
        id: 'preview-line-height',
        category: '화면',
        group: '프리뷰',
        label: '줄 간격',
        render: () => (
          <Row label="줄 간격">
            <NumberField
              value={previewLineHeight}
              step={0.1}
              min={1}
              max={3}
              onChange={(v) => setPreviewFont({ lineHeight: v })}
            />
          </Row>
        )
      },
      {
        id: 'about-app',
        category: '정보',
        group: '앱',
        label: '앱 정보',
        render: () => <AboutSetting section="app" />
      },
      {
        id: 'about-env',
        category: '정보',
        group: '실행 환경',
        label: '실행 환경',
        render: () => <AboutSetting section="env" />
      },
      ...SHORTCUT_GROUPS.flatMap(({ group, actions }) =>
        actions.map((action): SettingItem => ({
          id: `shortcut-${action}`,
          category: '단축키',
          group,
          label: SHORTCUT_LABELS[action],
          render: () => <ShortcutRow action={action} />
        }))
      )
    ],
    [
      showToolbar,
      setShowToolbar,
      vimMode,
      setVimMode,
      vimMouse,
      setVimMouse,
      editorFontFamily,
      editorFontSize,
      editorLineHeight,
      setEditorFont,
      previewFontFamily,
      previewFontSize,
      previewLineHeight,
      setPreviewFont,
      historyDir,
      handleChangeHistoryDir,
      handleResetHistoryDir
    ]
  )
}
