import { useEffect } from 'react'
import { DiffContent } from './DiffContent'
import { useSettingsStore } from '../stores/settingsStore'
import { matchesShortcut } from '../utils/shortcuts'

interface DiffViewProps {
  oldContent: string
  newContent: string
  oldLabel: string
  newLabel: string
  onApply: () => void
  onRestore: () => void
  onClose: () => void
}

/** 두 내용의 차이를 보여 주는 팝업 */
export function DiffView({
  oldContent,
  newContent,
  oldLabel,
  newLabel,
  onApply,
  onRestore,
  onClose
}: DiffViewProps): React.JSX.Element {
  const shortcuts = useSettingsStore((s) => s.shortcuts)

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      } else if (matchesShortcut(e, shortcuts.diffApply)) {
        e.preventDefault()
        onApply()
      } else if (matchesShortcut(e, shortcuts.diffRestore)) {
        e.preventDefault()
        onRestore()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts, onApply, onRestore, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,9,12,0.45)] backdrop-blur-[10px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[80vh] w-[860px] max-w-[95vw] flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <span className="text-[15px] font-semibold text-text">변경 내용 비교</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-1.5 text-text-secondary hover:bg-bg-mute hover:text-text focus:outline-none"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <DiffContent
            oldContent={oldContent}
            newContent={newContent}
            oldLabel={oldLabel}
            newLabel={newLabel}
          />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onRestore}
            title={shortcuts.diffRestore}
            className="rounded-md border border-border px-3 py-1.5 text-[13px] text-text-secondary hover:border-border-strong focus:outline-none"
          >
            복구
          </button>
          <button
            type="button"
            onClick={onApply}
            title={shortcuts.diffApply}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-text-inverted focus:outline-none"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  )
}
