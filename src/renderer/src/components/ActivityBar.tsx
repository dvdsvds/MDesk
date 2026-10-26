import { useSettingsStore } from '../stores/settingsStore'
import SearchIcon from '../icons/search.svg?react'
import CalendarIcon from '../icons/calendar.svg?react'
import TodoIcon from '../icons/todo.svg?react'
import BacklinksIcon from '../icons/backlinks.svg?react'
import GraphIcon from '../icons/graph.svg?react'
import SettingsIcon from '../icons/settings.svg?react'
import TrashIcon from '../icons/ctx-trash.svg?react'

/** 아이콘 줄 폭. 타이틀바 왼쪽 칸 폭을 맞출 때도 쓴다 */
export const ACTIVITY_BAR_WIDTH = 44

const BTN =
  'flex h-8 w-8 items-center justify-center rounded-md text-text-secondary outline-none transition-colors hover:bg-bg-mute hover:text-text'

/** 사이드바 왼쪽의 아이콘 세로 줄. 사이드바를 접어도 남는다 */
export function ActivityBar({
  onOpenSearch,
  onOpenDaily,
  onOpenTodo,
  onOpenBacklinks,
  onOpenGraph,
  onOpenSettings
}: {
  onOpenSearch: () => void
  onOpenDaily: () => void
  onOpenTodo: () => void
  onOpenBacklinks: () => void
  onOpenGraph: () => void
  onOpenSettings: () => void
}): React.JSX.Element {
  const shortcuts = useSettingsStore((s) => s.shortcuts)

  return (
    <nav style={{ width: ACTIVITY_BAR_WIDTH }} className="flex shrink-0 flex-col items-center gap-1 pb-2 pt-1">
      <button
        type="button"
        onClick={onOpenSearch}
        title={`검색 (${shortcuts.search})`}
        className={BTN}
      >
        <SearchIcon width={17} height={17} />
      </button>
      <button
        type="button"
        onClick={onOpenDaily}
        title={`오늘의 노트 (${shortcuts.dailyNote})`}
        className={BTN}
      >
        <CalendarIcon width={17} height={17} />
      </button>
      <button
        type="button"
        onClick={onOpenTodo}
        title={`할 일 (${shortcuts.todoDashboard})`}
        className={BTN}
      >
        <TodoIcon width={17} height={17} />
      </button>
      <button
        type="button"
        onClick={onOpenBacklinks}
        title={`백링크 (${shortcuts.backlinks})`}
        className={BTN}
      >
        <BacklinksIcon width={17} height={17} />
      </button>
      <button
        type="button"
        onClick={onOpenGraph}
        title={`그래프 (${shortcuts.graph})`}
        className={BTN}
      >
        <GraphIcon width={17} height={17} />
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => void window.api.workspace.openTrash()}
        title="휴지통 폴더 열기"
        className={BTN}
      >
        <TrashIcon width={17} height={17} />
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        title={`설정 (${shortcuts.toggleSettings})`}
        className={BTN}
      >
        <SettingsIcon width={17} height={17} />
      </button>
    </nav>
  )
}
