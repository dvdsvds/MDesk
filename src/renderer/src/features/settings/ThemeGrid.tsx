import { useSettingsStore } from '../../stores/settingsStore'
import { THEMES, type ThemeOption } from '../../utils/themes'

/**
 * 테마 카드 하나. 카드에만 data-theme을 붙여서 그 테마의 색 변수로 견본을 그린다
 * (앱 전체 색은 그대로). 막대는 위에서부터 제목, 목록 기호, 인라인 코드, 강조색이다
 */
export function ThemeCard({
  theme,
  selected,
  onSelect
}: {
  theme: ThemeOption
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex flex-col gap-2 rounded-[13px] p-[7px] pb-2.5 text-[13px] outline-none transition-colors ${
        selected
          ? 'bg-accent/15 text-text shadow-[inset_0_0_0_2px_var(--color-accent)]'
          : 'bg-bg-mute/60 text-text-secondary hover:text-text'
      }`}
    >
      <span
        data-theme={theme.id}
        data-mode={theme.mode}
        className="flex h-[100px] flex-col justify-center gap-1.5 rounded-[9px] px-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        style={{ background: 'var(--color-bg)' }}
      >
        <span className="h-1 w-[60%] rounded-sm" style={{ background: 'var(--color-syntax-heading)' }} />
        <span className="h-1 w-[80%] rounded-sm" style={{ background: 'var(--color-syntax-bullet)' }} />
        <span className="h-1 w-[45%] rounded-sm" style={{ background: 'var(--color-syntax-code)' }} />
        <span className="h-1 w-[35%] rounded-sm" style={{ background: 'var(--color-accent)' }} />
      </span>
      <span className="px-0.5 text-center">{theme.name}</span>
    </button>
  )
}

/** 설정 > 화면: 테마를 카드로 한 줄에 세 개씩 보여 주고, 누르면 바로 바뀐다 */
export function ThemeGrid(): React.JSX.Element {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  return (
    <div role="radiogroup" aria-label="테마" className="grid grid-cols-3 gap-3">
      {THEMES.map((t) => (
        <ThemeCard key={t.id} theme={t} selected={theme === t.id} onSelect={() => setTheme(t.id)} />
      ))}
    </div>
  )
}
