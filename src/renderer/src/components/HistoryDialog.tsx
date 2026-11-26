import { useEffect, useMemo, useState } from 'react'
import { DiffContent } from './DiffContent'
import { BTN_PRIMARY, BTN_SECONDARY, Dialog, DialogIcon } from './DialogParts'
import HistoryIcon from '../icons/ctx-history.svg?react'
import { fileNameOf } from '@renderer/utils/path'

interface HistoryEntry {
  id: number
  size: number
}

interface HistoryDialogProps {
  filePath: string
  currentContent: string
  onRestore: (content: string) => void
  onClose: () => void
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** 목록의 묶음 이름: 오늘, 어제, 그 밖에는 날짜 */
function groupLabel(id: number): string {
  const d = new Date(id)
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (dayKey(d) === dayKey(today)) return '오늘'
  if (dayKey(d) === dayKey(yesterday)) return '어제'
  if (d.getFullYear() === today.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function formatTime(id: number): string {
  const d = new Date(id)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`
}

export function HistoryDialog({
  filePath,
  currentContent,
  onRestore,
  onClose
}: HistoryDialogProps): React.JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)

  useEffect(() => {
    void window.api.workspace.listHistory(filePath).then((list) => {
      setEntries(list)
      setSelectedId(list[0]?.id ?? null)
    })
  }, [filePath])

  useEffect(() => {
    if (selectedId === null) {
      setSnapshot(null)
      return
    }
    let cancelled = false
    void window.api.workspace.readHistory(filePath, selectedId).then((text) => {
      if (!cancelled) setSnapshot(text)
    })
    return () => {
      cancelled = true
    }
  }, [filePath, selectedId])

  const groups = useMemo(() => {
    const out: { label: string; items: HistoryEntry[] }[] = []
    for (const entry of entries ?? []) {
      const label = groupLabel(entry.id)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(entry)
      else out.push({ label, items: [entry] })
    }
    return out
  }, [entries])

  return (
    <Dialog width={1080} height={660} onClose={onClose}>
      <div className="flex h-[72px] shrink-0 items-center gap-3 px-6">
        <DialogIcon>
          <HistoryIcon width={18} height={18} />
        </DialogIcon>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[16px] font-semibold text-text">스냅샷</h2>
          <span className="truncate text-[12.5px] text-text-tertiary">{fileNameOf(filePath)}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="ml-auto flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-bg-mute text-text-secondary transition-colors hover:text-text"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {entries !== null && entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-text-tertiary">
          스냅샷이 없습니다. 저장하면 덮어쓰기 전 내용이 스냅샷으로 남습니다.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3.5 px-6">
          <nav aria-label="스냅샷 목록" className="flex w-[210px] shrink-0 flex-col gap-1 overflow-y-auto">
            {groups.map((group, gi) => (
              <div key={group.label} className="flex flex-col gap-1">
                <div
                  className={`px-1.5 pb-1.5 text-[11.5px] font-semibold text-text-tertiary ${
                    gi === 0 ? 'pt-1' : 'pt-2.5'
                  }`}
                >
                  {group.label}
                </div>
                {group.items.map((entry) => {
                  const active = selectedId === entry.id
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setSelectedId(entry.id)}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] outline-none ${
                        active
                          ? 'bg-accent/15 text-text shadow-[inset_0_0_0_1px_rgba(110,155,255,0.35)]'
                          : 'text-text-secondary hover:bg-bg-mute/60'
                      }`}
                    >
                      <span
                        className={`size-2 shrink-0 rounded-full ${active ? 'bg-accent' : 'bg-text/20'}`}
                      />
                      <span className="flex-1">{formatTime(entry.id)}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
          <div className="min-h-0 min-w-0 flex-1">
            {snapshot !== null && selectedId !== null && (
              <DiffContent
                key={selectedId}
                cards
                oldContent={snapshot}
                newContent={currentContent}
                oldLabel="이전"
                newLabel="현재"
              />
            )}
          </div>
        </div>
      )}

      <div className="mt-[18px] flex h-[72px] shrink-0 items-center justify-end gap-2.5 border-t border-white/[0.05] bg-bg px-6">
        <button type="button" onClick={onClose} className={BTN_SECONDARY}>
          닫기
        </button>
        <button
          type="button"
          disabled={snapshot === null}
          onClick={() => snapshot !== null && onRestore(snapshot)}
          className={`${BTN_PRIMARY} px-4`}
        >
          적용
        </button>
      </div>
    </Dialog>
  )
}
