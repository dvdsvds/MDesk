import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_LABELS,
  eventToShortcut,
  findConflict,
  type ShortcutAction
} from '../../utils/shortcuts'

interface ShortcutRowProps {
  action: ShortcutAction
}

export function ShortcutRow({ action }: ShortcutRowProps): React.JSX.Element {
  const combo = useSettingsStore((s) => s.shortcuts[action])
  const shortcuts = useSettingsStore((s) => s.shortcuts)
  const setShortcut = useSettingsStore((s) => s.setShortcut)
  const resetShortcut = useSettingsStore((s) => s.resetShortcut)
  const [capturing, setCapturing] = useState(false)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!capturing) return
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setCapturing(false)
        return
      }
      const newCombo = eventToShortcut(e)
      if (!newCombo) return
      const conflictWith = findConflict(shortcuts, action, newCombo)
      if (conflictWith) {
        setConflictMessage(`이미 "${SHORTCUT_LABELS[conflictWith]}"에서 쓰고 있습니다.`)
        return
      }
      setShortcut(action, newCombo)
      setCapturing(false)
      setConflictMessage(null)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [capturing, shortcuts, action, setShortcut])

  return (
    <div className="flex min-h-[46px] items-center justify-between gap-4 px-[18px]">
      <span className="text-[13.5px] text-text">{SHORTCUT_LABELS[action]}</span>
      <div className="flex items-center gap-1">
        {conflictMessage && <span className="text-xs text-danger">{conflictMessage}</span>}
        <button
          type="button"
          onClick={() => {
            setConflictMessage(null)
            setCapturing(true)
          }}
          aria-label={`${SHORTCUT_LABELS[action]} 단축키 바꾸기`}
          className={`flex items-center gap-1 rounded-md focus:outline-none ${
            capturing ? 'px-2 py-1 text-[12px] text-accent ring-1 ring-accent' : ''
          }`}
        >
          {capturing
            ? '새 단축키 입력…'
            : combo.split('+').map((k, i) => (
                <kbd
                  key={`${k}-${i}`}
                  className="inline-flex h-6 min-w-[22px] items-center justify-center rounded-md bg-bg px-[7px] font-mono text-[11.5px] text-text shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]"
                >
                  {k}
                </kbd>
              ))}
        </button>
        {combo !== DEFAULT_SHORTCUTS[action] && (
          <button
            type="button"
            onClick={() => resetShortcut(action)}
            title="기본값"
            className="rounded px-1.5 text-xs text-text-tertiary hover:text-accent"
          >
            ↺
          </button>
        )}
      </div>
    </div>
  )
}
