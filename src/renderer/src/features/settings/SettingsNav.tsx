import { CATEGORIES, type Category } from './useSettingItems'
import SettingsIcon from '../../icons/settings.svg?react'

export function SettingsNav({
  query,
  onQueryChange,
  onQueryClear,
  activeCategory,
  highlightCategory,
  onSelectCategory
}: {
  query: string
  onQueryChange: (value: string) => void
  onQueryClear: () => void
  activeCategory: Category
  highlightCategory: boolean
  onSelectCategory: (cat: Category) => void
}): React.JSX.Element {
  return (
    <nav
      aria-label="설정 분류"
      className="flex w-[220px] shrink-0 flex-col gap-0.5 border-r border-border bg-bg-soft px-3 py-[18px]"
    >
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-accent/15 text-accent">
          <SettingsIcon width={18} height={18} />
        </span>
        <span className="text-[16px] font-semibold text-text">설정</span>
      </div>
      <div className="relative mb-2.5">
        <svg
          width="15"
          height="15"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="4.9" />
          <path d="M11.6 11.6L15.5 15.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="설정 검색"
          className="h-[34px] w-full rounded-[10px] bg-bg-mute pl-8 pr-7 text-[13px] text-text outline-none transition-shadow placeholder:text-text-tertiary focus:ring-1 focus:ring-accent/60"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={onQueryClear}
            title="지우기"
            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-text-tertiary hover:text-text"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        )}
      </div>
      {CATEGORIES.map((cat) => {
        const active = highlightCategory && activeCategory === cat
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onSelectCategory(cat)}
            aria-current={active ? 'page' : undefined}
            className={`h-9 w-full rounded-[10px] px-3 text-left text-[13.5px] outline-none transition-colors ${
              active
                ? 'bg-accent/15 font-medium text-text'
                : 'text-text-secondary hover:bg-bg-mute/60 hover:text-text'
            }`}
          >
            {cat}
          </button>
        )
      })}
    </nav>
  )
}
