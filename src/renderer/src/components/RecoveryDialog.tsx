import { useEffect, useState } from 'react'
import { DiffContent } from './DiffContent'
import { useSettingsStore } from '../stores/settingsStore'
import { matchesShortcut } from '../utils/shortcuts'
import { fileNameOf, folderTrail } from '@renderer/utils/path'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { BTN_PRIMARY, BTN_SECONDARY, Dialog, DialogIcon } from './DialogParts'
import UndoIcon from '../icons/tb-undo.svg?react'

interface RecoverableItem {
  tmpPath: string
  targetPath: string
  tmpContent: string
  currentContent: string | null
}

interface RecoveryDialogProps {
  items: RecoverableItem[]
  onDone: () => void
}

export function RecoveryDialog({
  items: initialItems,
  onDone
}: RecoveryDialogProps): React.JSX.Element {
  const [items, setItems] = useState(initialItems)
  const [checked, setChecked] = useState<Set<string>>(new Set(initialItems.map((i) => i.tmpPath)))
  const [selected, setSelected] = useState(initialItems[0]?.tmpPath ?? null)
  const shortcuts = useSettingsStore((s) => s.shortcuts)
  const rootDir = useWorkspaceStore((s) => s.rootDir)

  const selectedItem = items.find((i) => i.tmpPath === selected) ?? null

  const removeItem = (tmpPath: string): void => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.tmpPath === tmpPath)
      const next = prev.filter((i) => i.tmpPath !== tmpPath)
      if (next.length === 0) {
        onDone()
      } else if (selected === tmpPath) {
        setSelected(next[idx]?.tmpPath ?? next[Math.max(0, idx - 1)]?.tmpPath ?? next[0].tmpPath)
      }
      return next
    })
  }

  const applyOne = (item: RecoverableItem): void => {
    void window.api.workspace.applyRecovery(item.tmpPath, item.targetPath).then(() => {
      removeItem(item.tmpPath)
    })
  }

  const discardOne = (item: RecoverableItem): void => {
    void window.api.workspace.discardRecovery(item.tmpPath).then(() => {
      removeItem(item.tmpPath)
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!selectedItem) return
      if (matchesShortcut(e, shortcuts.diffApply)) {
        e.preventDefault()
        applyOne(selectedItem)
      } else if (matchesShortcut(e, shortcuts.diffRestore)) {
        e.preventDefault()
        discardOne(selectedItem)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedItem, shortcuts])

  const handleRecoverChecked = (): void => {
    void Promise.all(
      items.map((item) =>
        checked.has(item.tmpPath)
          ? window.api.workspace.applyRecovery(item.tmpPath, item.targetPath)
          : window.api.workspace.discardRecovery(item.tmpPath)
      )
    ).then(onDone)
  }

  return (
    <Dialog width={1000} height={600}>
      <div className="flex shrink-0 items-center gap-3 px-6 pb-[18px] pt-6">
        <DialogIcon tone="warning">
          <UndoIcon width={20} height={20} />
        </DialogIcon>
        <h2 className="text-[17px] font-semibold text-text">복구</h2>
      </div>

      <div className="flex min-h-0 flex-1 gap-3.5 px-6">
        <div aria-label="복구할 파일" className="flex w-[230px] shrink-0 flex-col gap-1 overflow-y-auto">
          {items.map((item) => {
            const active = selected === item.tmpPath
            return (
              <div
                key={item.tmpPath}
                onClick={() => setSelected(item.tmpPath)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-[9px] ${
                  active
                    ? 'bg-accent/15 shadow-[inset_0_0_0_1px_rgba(110,155,255,0.35)]'
                    : 'hover:bg-bg-mute/60'
                }`}
              >
                <input
                  type="checkbox"
                  className="ui-checkbox"
                  aria-label={`${fileNameOf(item.targetPath)} 복구`}
                  checked={checked.has(item.tmpPath)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() =>
                    setChecked((prev) => {
                      const next = new Set(prev)
                      if (next.has(item.tmpPath)) next.delete(item.tmpPath)
                      else next.add(item.tmpPath)
                      return next
                    })
                  }
                />
                <span className="flex min-w-0 flex-col gap-px">
                  <span
                    className={`truncate text-[13.5px] ${active ? 'font-medium text-text' : 'text-text'}`}
                  >
                    {fileNameOf(item.targetPath)}
                  </span>
                  <span className="truncate text-[11.5px] text-text-tertiary">
                    {folderTrail(rootDir, item.targetPath)}
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="min-h-0 min-w-0 flex-1">
          {selectedItem && (
            <DiffContent
              key={selectedItem.tmpPath}
              cards
              oldContent={selectedItem.currentContent ?? ''}
              newContent={selectedItem.tmpContent}
              oldLabel="현재"
              newLabel="복구"
            />
          )}
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-2 px-6 pb-[22px] pt-5">
        <button type="button" onClick={onDone} className={BTN_SECONDARY}>
          취소
        </button>
        <button
          type="button"
          onClick={handleRecoverChecked}
          className={`${BTN_PRIMARY} px-4`}
        >
          복구
        </button>
      </div>
    </Dialog>
  )
}
