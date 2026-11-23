import { Card } from './SettingsParts'
import type { Category, SettingItem } from './useSettingItems'

export interface Section {
  group?: string
  items: SettingItem[]
}

export function SettingsContent({
  showSearchResults,
  filtered,
  sections,
  activeCategory,
  onGoCategory,
  onResetEditorFont,
  onResetShortcuts
}: {
  showSearchResults: boolean
  filtered: SettingItem[]
  sections: Section[]
  activeCategory: Category
  onGoCategory: (cat: Category) => void
  onResetEditorFont: () => void
  onResetShortcuts: () => void
}): React.JSX.Element {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pl-7 pr-4 pb-4 pt-1 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] hover:[scrollbar-color:var(--color-border-strong)_transparent]">
      {showSearchResults ? (
        filtered.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-text-tertiary">검색 결과가 없습니다</p>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="mb-4">
              <button
                type="button"
                onClick={() => onGoCategory(item.category)}
                className="mb-1.5 ml-0.5 text-[11.5px] text-text-tertiary transition-colors hover:text-accent"
              >
                {[item.category, item.group, item.label].filter(Boolean).join(' › ')}
              </button>
              <Card>{item.render()}</Card>
            </div>
          ))
        )
      ) : (
        <>
          {sections.map((sec, i) => (
            <section key={`${sec.group ?? 'none'}-${i}`} className="mb-5 last:mb-0">
              {sec.group && (
                <div className="mb-2 flex items-center justify-between px-0.5 text-xs text-text-tertiary">
                  <span>{sec.group}</span>
                  {sec.group === '에디터' && (
                    <button
                      type="button"
                      onClick={onResetEditorFont}
                      className="transition-colors hover:text-accent"
                    >
                      기본값
                    </button>
                  )}
                </div>
              )}
              <Card>
                {sec.items.map((item) => (
                  <div key={item.id}>{item.render()}</div>
                ))}
              </Card>
            </section>
          ))}
          {activeCategory === '단축키' && (
            <button
              type="button"
              onClick={onResetShortcuts}
              className="h-8 rounded-lg bg-bg-mute px-3 text-[13px] text-text-secondary outline-none transition-colors hover:text-danger"
            >
              모두 기본값
            </button>
          )}
        </>
      )}
    </div>
  )
}