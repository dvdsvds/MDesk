import { useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { THEMES, osDefaultTheme, type ThemeId } from '../utils/themes'

interface ThemePickerDialogProps {
  onConfirm: (id: ThemeId) => void
}

/**
 * 새로 설치해서 처음 실행할 때만 한 번 뜨는 테마 선택 창(업데이트한 사용자에게는 뜨지 않는다).
 * Paper 4종만 보이고, OS 설정에 맞는 테마가 미리 골라져 있어서
 * 바로 "시작하기"만 눌러도 된다. 나중에는 설정 > 화면 > 색 테마에서 바꿀 수 있다.
 */
export function ThemePickerDialog({ onConfirm }: ThemePickerDialogProps): React.JSX.Element {
  const setTheme = useSettingsStore((s) => s.setTheme)
  // 지금 쓰는 테마가 Paper 4종 중 하나면 그대로 미리 고르고, 아니면 OS 설정에 맞는 쪽을 고른다
  const [selected, setSelected] = useState<ThemeId>(() => {
    const current = useSettingsStore.getState().theme
    return THEMES.some((t) => t.builtin && t.id === current) ? current : osDefaultTheme()
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-[30rem] max-w-[92vw] rounded-xl border border-border bg-bg-elevated p-5 shadow-2xl">
        <h2 className="text-[15px] font-semibold text-text">테마를 골라 주세요</h2>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          Gruvbox, Tokyo Night 같은 다른 테마는 설정에서 고를 수 있어요.
        </p>
        <div role="radiogroup" className="mt-4 grid grid-cols-2 gap-3">
          {THEMES.filter((t) => t.builtin).map((t) => {
            const active = t.id === selected
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setSelected(t.id)
                  // 고르는 즉시 화면에 적용해서 어떻게 보이는지 바로 확인할 수 있게 한다
                  setTheme(t.id)
                }}
                className={`rounded-lg border p-2 text-left outline-none transition-colors ${
                  active
                    ? 'border-accent ring-1 ring-accent'
                    : 'border-border hover:border-border-strong'
                }`}
              >
                <div
                  className="flex h-16 flex-col justify-between rounded-md border border-black/10 p-2"
                  style={{ background: t.swatch[0] }}
                >
                  <span className="h-1.5 w-12 rounded-full" style={{ background: t.swatch[1] }} />
                  <span className="h-1.5 w-8 rounded-full" style={{ background: t.swatch[2] }} />
                </div>
                <div className="mt-2 text-[13px] text-text">{t.name}</div>
              </button>
            )
          })}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-text-inverted focus:outline-none"
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  )
}
