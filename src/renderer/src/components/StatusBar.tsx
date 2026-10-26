import { useSettingsStore } from '../stores/settingsStore'
import type { Tab } from '../stores/tabsStore'
import { CsvStatus } from './CsvStatus'

interface StatusBarProps {
  tab: Tab | null
  isViewer: boolean
  /** 맨 오른쪽에 붙일 것 (노트 속성) */
  right?: React.ReactNode
}

/** 오른쪽에 그때그때 필요한 것(csv 정보, 100%가 아닌 확대 비율)만. vim 모드는 에디터 칸, 노트 상태는 에디터 머리 줄에 보인다 */
export function StatusBar({
  tab,
  isViewer,
  right
}: StatusBarProps): React.JSX.Element {
  const uiZoom = useSettingsStore((s) => s.uiZoom)
  const setUiZoom = useSettingsStore((s) => s.setUiZoom)

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between px-3 text-[11px] tabular-nums text-text-tertiary">
      <div />
      <div className="flex items-center gap-3">
        {tab && !isViewer && <CsvStatus />}
        {uiZoom !== 100 && (
          <button
            type="button"
            onClick={() => setUiZoom(100)}
            title="100%로 초기화"
            className="hover:text-text"
          >
            {uiZoom}%
          </button>
        )}
        {right}
      </div>
    </footer>
  )
}
