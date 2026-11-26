import { useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { THEMES, osDefaultTheme, type ThemeId } from '../utils/themes'
import { AppIcon } from './AppIcon'
import { BTN_PRIMARY, Dialog, DialogBody, DialogHeader } from './DialogParts'
import { ThemeCard } from '../features/settings/ThemeGrid'

interface ThemePickerDialogProps {
  onConfirm: (id: ThemeId) => void
}

/**
 * 새로 설치해서 처음 실행할 때만 한 번 뜨는 테마 선택 창(업데이트한 사용자에게는 뜨지 않는다).
 * Paper 4종만 보이고, OS 설정에 맞는 테마가 미리 골라져 있어서
 * 바로 "시작하기"만 눌러도 된다. 나중에는 설정 > 화면에서 바꿀 수 있다.
 */
export function ThemePickerDialog({ onConfirm }: ThemePickerDialogProps): React.JSX.Element {
  const setTheme = useSettingsStore((s) => s.setTheme)
  // 지금 쓰는 테마가 Paper 4종 중 하나면 그대로 미리 고르고, 아니면 OS 설정에 맞는 쪽을 고른다
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
                // 고르는 즉시 화면에 적용해서 어떻게 보이는지 바로 확인할 수 있게 한다
                setTheme(t.id)
              }}
            />
          ))}
        </div>
      </DialogBody>
      <div className="px-7 pb-6 pt-6">
        <button type="button" onClick={() => onConfirm(selected)} className={`${BTN_PRIMARY} w-full`}>
          시작하기
        </button>
      </div>
    </Dialog>
  )
}
