import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useSettingsStore } from '../../stores/settingsStore'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useSettingItems, type Category } from './useSettingItems'
import { SettingsNav } from './SettingsNav'
import { SettingsContent, type Section } from './SettingsContent'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps): React.JSX.Element {
  const resetAllShortcuts = useSettingsStore((s) => s.resetAllShortcuts)

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('저장')
  const [viewMode, setViewMode] = useState<'search' | 'category'>('category')
  const [confirmResetShortcuts, setConfirmResetShortcuts] = useState(false)

  const items = useSettingItems()

  const filtered = useMemo(() => {
    if (query.trim().length === 0) return []
    const q = query.toLowerCase()
    return items.filter(
      (item) =>
        item.category.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        (item.group?.toLowerCase().includes(q) ?? false)
    )
  }, [items, query])

  const showSearchResults = viewMode === 'search' && query.trim().length > 0

  // 같은 그룹끼리 이어진 항목을 한 카드로 묶는다.
  const sections: Section[] = []
  for (const item of items.filter((i) => i.category === activeCategory)) {
    const last = sections[sections.length - 1]
    if (last && last.group === item.group) last.items.push(item)
    else sections.push({ group: item.group, items: [item] })
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      style={{ willChange: 'opacity' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        style={{ willChange: 'transform, opacity' }}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[620px] max-h-[calc(100vh-48px)] w-[880px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[18px] border border-border bg-bg-elevated shadow-[0_40px_100px_rgba(0,0,0,0.55)]"
      >
        <SettingsNav
          query={query}
          onQueryChange={(value) => {
            setQuery(value)
            setViewMode(value.trim().length > 0 ? 'search' : 'category')
          }}
          onQueryClear={() => {
            setQuery('')
            setViewMode('category')
          }}
          activeCategory={activeCategory}
          highlightCategory={!showSearchResults}
          onSelectCategory={(cat) => {
            setActiveCategory(cat)
            setViewMode('category')
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[70px] shrink-0 items-center gap-3 px-7">
            <h2 className="text-[18px] font-semibold text-text">
              {showSearchResults ? '검색 결과' : activeCategory}
            </h2>
            {!showSearchResults && activeCategory === '단축키' && (
              <button
                type="button"
                onClick={() => setConfirmResetShortcuts(true)}
                className="h-[30px] rounded-lg bg-bg-mute px-3 text-[12.5px] text-text-secondary outline-none transition-colors hover:text-text"
              >
                초기화
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="ml-auto flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-bg-mute text-text-secondary transition-colors hover:text-text"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

        <SettingsContent
          showSearchResults={showSearchResults}
          filtered={filtered}
          sections={sections}
          onGoCategory={(cat) => {
            setActiveCategory(cat)
            setViewMode('category')
          }}
        />
        </div>

        {confirmResetShortcuts && (
          <ConfirmDialog
            title="단축키 초기화"
            icon="reset"
            message="모든 단축키를 기본값으로 되돌립니다."
            confirmLabel="초기화"
            danger
            onConfirm={() => {
              resetAllShortcuts()
              setConfirmResetShortcuts(false)
            }}
            onCancel={() => setConfirmResetShortcuts(false)}
          />
        )}
      </motion.div>
    </motion.div>
  )
}
