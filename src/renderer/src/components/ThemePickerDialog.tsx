import { useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { THEMES, osDefaultTheme, type ThemeId } from '../utils/themes'
import { AppIcon } from './AppIcon'
import { BTN_PRIMARY, Dialog, DialogBody, DialogHeader } from './DialogParts'
import { ThemeCard } from '../features/settings/ThemeGrid'

interface ThemePickerDialogProps {
  onConfirm: (id: ThemeId) => void
}

/** 새로 설치해서 처음 실행할 때만 한 번 뜨는 테마 선택 창(업데이트한 사용자에게는 뜨지 않는다). */
export function ThemePickerDialog({ onConfirm }: ThemePickerDialogProps): React.JSX.Element {
  const setTheme = useSettingsStore((s) => s.setTheme)
  /** 지금 쓰는 테마가 Paper 4종 중 하나면 그대로 미리 고르고, 아니면 OS 설정에 맞는 쪽을 고른다 */
  const [selected, setSelected] = useState<ThemeId>(() => {
    const current = useSettingsStore.getState().theme
    return THEMES.some((t) => t.builtin && t.id === current) ? current : osDefaultTheme()
  })

  return (
    <Dialog width={520}>
      <DialogHeader rawIcon icon={<AppIcon />} title="테마 선택" />
      <DialogBody>
        <div role="radiogroup" aria-label="테마" className="mt-0.5 grid grid-cols-2 gap-3">
          {THEMES.filter((t) => t.builtin).map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              selected={t.id === selected}
              onSelect={() => {
                setSelected(t.id)
                setTheme(t.id)
              }}
            />
          ))}
        </div>
      </DialogBody>
      <div className="px-7 pb-6 pt-6">
        <button type="button" onClick={() => onConfirm(selected)} className={`${BTN_PRIMARY} w-full`}>
          시작
        </button>
      </div>
    </Dialog>
  )
}
