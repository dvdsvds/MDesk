import { useLayoutEffect, useRef, useState } from 'react'
import { Card } from './SettingsParts'
import type { Category, SettingItem } from './useSettingItems'

export interface Section {
  group?: string
  items: SettingItem[]
}

function SectionBody({ items }: { items: SettingItem[] }): React.JSX.Element {
  if (items.every((i) => i.bare)) {
    return (
      <>
        {items.map((item) => (
          <div key={item.id}>{item.render()}</div>
        ))}
      </>
    )
  }
  return (
    <Card>
      {items.map((item) => (
        <div key={item.id}>{item.render()}</div>
      ))}
    </Card>
  )
}

export function SettingsContent({
  showSearchResults,
  filtered,
  sections,
  onGoCategory
}: {
  showSearchResults: boolean
  filtered: SettingItem[]
  sections: Section[]
  onGoCategory: (cat: Category) => void
}): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollbarWidth, setScrollbarWidth] = useState(0)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) setScrollbarWidth(el.offsetWidth - el.clientWidth)
  }, [])

  return (
    <div
      ref={scrollRef}
      style={{ paddingRight: Math.max(0, 28 - scrollbarWidth) }}
      className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-7 pb-7 [scrollbar-gutter:stable] [scrollbar-color:transparent_transparent] [scrollbar-width:thin] hover:[scrollbar-color:var(--color-border-strong)_transparent]"
    >
      {showSearchResults ? (
        filtered.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-text-tertiary">검색 결과가 없습니다</p>
        ) : (
          filtered.map((item) => (
            <section key={item.id} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onGoCategory(item.category)}
                className="mx-1 self-start text-[12px] font-semibold text-text-tertiary transition-colors hover:text-accent"
              >
                {[item.category, item.group].filter(Boolean).join(' / ')}
              </button>
              <SectionBody items={[item]} />
            </section>
          ))
        )
      ) : (
        sections.map((sec, i) => (
          <section key={`${sec.group ?? 'none'}-${i}`} className="flex flex-col gap-2">
            {sec.group && (
              <h3 className="mx-1 text-[12px] font-semibold text-text-tertiary">{sec.group}</h3>
            )}
            <SectionBody items={sec.items} />
          </section>
        ))
      )}
    </div>
  )
}
