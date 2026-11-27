import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastStore } from '../../stores/toastStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { ShortcutRow } from './ShortcutRow'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { SHORTCUT_LABELS, type ShortcutAction } from '../../utils/shortcuts'
import { ThemeGrid } from './ThemeGrid'
import { Row, Stepper, Toggle } from './SettingsParts'
import { FontSelect } from './FontSelect'
import { AboutSetting } from './AboutSetting'
import { CloudSetting } from './CloudSetting'
import { VimSetting } from './VimSetting'

const SHORTCUT_GROUPS: { group: string; actions: ShortcutAction[] }[] = [
  {
    group: '일반',
    actions: [
      'save',
      'search',
      'toggleSettings',
      'nextTab',
      'prevTab',
      'viewEditor',
      'viewSplit',
      'viewPreview',
      'toggleToc',
      'zoomIn',
      'zoomOut',
      'zoomReset'
    ]
  },
  {
    group: '사이드바',
    actions: ['toggleSidebar', 'newFolder', 'renameItem', 'revealItem', 'exportItem']
  },
  { group: '파일 목록', actions: ['newNote'] }
]

export const CATEGORIES = ['저장', '에디터', '화면', '단축키', '정보'] as const
export type Category = (typeof CATEGORIES)[number]

export interface SettingItem {
  id: string
  category: Category
  group?: string
  label: string
  bare?: boolean
  render: () => React.ReactNode
}

export function useSettingItems(): SettingItem[] {
  const showToolbar = useSettingsStore((s) => s.showToolbar)
  const setShowToolbar = useSettingsStore((s) => s.setShowToolbar)
  const autoSave = useSettingsStore((s) => s.autoSave)
  const setAutoSave = useSettingsStore((s) => s.setAutoSave)
  const editorFontFamily = useSettingsStore((s) => s.editorFontFamily)
  const editorFontSize = useSettingsStore((s) => s.editorFontSize)
  const editorLineHeight = useSettingsStore((s) => s.editorLineHeight)
  const setEditorFont = useSettingsStore((s) => s.setEditorFont)

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
        pushToast({ kind: 'info', message: '스냅샷을 새 위치로 옮겼습니다.' })
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
        id: 'auto-save',
        category: '저장',
        label: '자동 저장',
        render: () => (
          <Row label="자동 저장">
            <Toggle checked={autoSave} onChange={() => setAutoSave(!autoSave)} />
          </Row>
        )
      },
      {
        id: 'history-dir',
        category: '저장',
        group: '저장 위치',
        label: '저장 위치',
        render: () => (
          <div className="flex items-center gap-2 px-[18px] py-3.5">
            <div className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-bg px-3">
              <FileTypeIcon name="" kind="folder" size={15} raise={false} />
              <span
                className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-text-secondary"
                title={historyDir}
              >
                {historyDir || '…'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleChangeHistoryDir}
              className="h-[38px] shrink-0 rounded-[10px] bg-accent-soft px-4 text-[13px] font-medium text-accent outline-none transition-[filter] hover:brightness-110"
            >
              변경
            </button>
            <button
              type="button"
              onClick={handleResetHistoryDir}
              className="h-[38px] shrink-0 rounded-[10px] bg-bg-mute px-3.5 text-[13px] font-medium text-text outline-none transition-[filter] hover:brightness-110"
            >
              기본값
            </button>
          </div>
        )
      },
      {
        id: 'cloud-google',
        category: '저장',
        group: 'Google Drive',
        label: 'Google Drive',
        render: () => <CloudSetting />
      },
      {
        id: 'show-toolbar',
        category: '에디터',
        group: '일반',
        label: '서식 툴바',
        render: () => (
          <Row label="서식 툴바">
            <Toggle checked={showToolbar} onChange={() => setShowToolbar(!showToolbar)} />
          </Row>
        )
      },
      {
        id: 'vim-mode',
        category: '에디터',
        group: '일반',
        label: 'Vim',
        render: () => <VimSetting />
      },
      {
        id: 'editor-font-family',
        category: '에디터',
        group: '글꼴',
        label: '글꼴',
        render: () => (
          <Row label="글꼴">
            <FontSelect value={editorFontFamily} onChange={(family) => setEditorFont({ family })} />
          </Row>
        )
      },
      {
        id: 'editor-font-size',
        category: '에디터',
        group: '글꼴',
        label: '글꼴 크기',
        render: () => (
          <Row label="글꼴 크기">
            <Stepper
              label="글꼴 크기"
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
        category: '에디터',
        group: '글꼴',
        label: '줄 간격',
        render: () => (
          <Row label="줄 간격">
            <Stepper
              label="줄 간격"
              value={editorLineHeight}
              step={0.1}
              min={1}
              max={3}
              format={(v) => v.toFixed(1)}
              onChange={(v) => setEditorFont({ lineHeight: v })}
            />
          </Row>
        )
      },
      {
        id: 'theme',
        category: '화면',
        label: '테마',
        bare: true,
        render: () => <ThemeGrid />
      },
      {
        id: 'about-app',
        category: '정보',
        group: '애플리케이션',
        label: '애플리케이션',
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
      autoSave,
      setAutoSave,
      showToolbar,
      setShowToolbar,
      editorFontFamily,
      editorFontSize,
      editorLineHeight,
      setEditorFont,
      historyDir,
      handleChangeHistoryDir,
      handleResetHistoryDir
    ]
  )
}
