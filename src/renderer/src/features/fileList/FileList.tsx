import { useEffect, useMemo, useState } from 'react'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { useNotePropsStore } from '../../stores/notePropsStore'
import { PROPERTY_COLORS, statusOf } from '../../utils/noteProperties'
import { isMarkdownPath } from '../../utils/fileKind'
import NewFileIcon from '../../icons/new-file.svg?react'
import SearchIcon from '../../icons/search.svg?react'

export interface FileListItem {
  path: string
  name: string
  /** 마지막 수정 시각(ms). 모르면 0 */
  mtime: number
  snippet: string
  /** Drive 파일이면 Drive 항목 id */
  driveId?: string
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 오늘이면 시각, 어제면 "어제", 이번 주면 요일, 그 밖에는 날짜 */
export function formatModified(ms: number, now = new Date()): string {
  if (!ms) return ''
  const d = new Date(ms)
  const startOfDay = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (days <= 0) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (days === 1) return '어제'
  if (days < 7) return WEEKDAYS[d.getDay()]
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()}`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function displayName(name: string): string {
  return isMarkdownPath(name) ? name.replace(/\.(md|markdown)$/i, '') : name
}

/** 3단 화면의 가운데 칸: 사이드바에서 고른 폴더의 파일 목록 */
export function FileList({
  title,
  items,
  loading,
  activeFilePath,
  onOpenFile,
  onNewFile
}: {
  title: string
  items: FileListItem[]
  loading?: boolean
  activeFilePath: string | null
  onOpenFile: (item: FileListItem) => void
  /** 없으면 새 파일 버튼을 숨긴다 */
  onNewFile?: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const byPath = useNotePropsStore((s) => s.byPath)

  // 폴더를 바꾸면 검색어를 비운다
  useEffect(() => setQuery(''), [title])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) => it.name.toLowerCase().includes(q) || it.snippet.toLowerCase().includes(q)
    )
  }, [items, query])

  return (
    <section
      aria-label="파일 목록"
      className="flex h-full min-h-0 flex-col border-r border-border bg-bg-soft"
    >
      <div className="titlebar-drag flex shrink-0 flex-col gap-2.5 px-3.5 pb-2.5 pt-3">
        <div className="flex items-center gap-2">
          <h2 className="m-0 min-w-0 truncate text-[17px] font-bold text-text">{title}</h2>
          {onNewFile && (
            <button
              type="button"
              onClick={onNewFile}
              title="새 파일"
              className="titlebar-no-drag ml-auto flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md text-text-secondary outline-none transition-colors hover:bg-bg-mute hover:text-text"
            >
              <NewFileIcon width={19} height={19} />
            </button>
          )}
        </div>
        <label className="titlebar-no-drag flex h-8 items-center gap-2 rounded-lg border border-border bg-bg px-2.5 text-text-tertiary">
          <SearchIcon width={15} height={15} className="shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-text outline-none placeholder:text-text-tertiary"
          />
        </label>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-auto">
        {loading && items.length === 0 ? (
          <div className="px-3.5 py-2 text-[12.5px] text-text-tertiary">불러오는 중…</div>
        ) : shown.length === 0 ? (
          <div className="px-3.5 py-2 text-[12.5px] text-text-tertiary">
            {query ? '일치하는 파일이 없습니다' : '파일이 없습니다'}
          </div>
        ) : (
          shown.map((it) => {
            const active = it.path === activeFilePath
            const status = byPath[it.path]?.status
            const tag = status && isMarkdownPath(it.name) ? statusOf(status) : null
            const tagColor = tag ? PROPERTY_COLORS[tag.color] : ''
            return (
              <button
                key={it.path}
                type="button"
                onClick={() => onOpenFile(it)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full gap-2.5 border-l-[3px] py-3 pl-[11px] pr-3.5 text-left outline-none transition-colors ${
                  active
                    ? 'border-accent bg-bg-mute'
                    : 'border-transparent border-b-border/40 hover:bg-bg-mute/60'
                }`}
              >
                <span className="flex w-[34px] shrink-0 flex-col items-center gap-1.5 pt-0.5">
                  <FileTypeIcon name={it.name} kind="file" size={18} raise={false} />
                  {tag && (
                    <span
                      className="rounded-full px-1.5 text-[10.5px] font-medium leading-[16px]"
                      style={{ background: `${tagColor}26`, color: tagColor }}
                    >
                      {tag.label}
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-[13px] font-semibold text-text">
                      {displayName(it.name)}
                    </span>
                    <span className="ml-auto shrink-0 text-[11.5px] text-text-tertiary">
                      {formatModified(it.mtime)}
                    </span>
                  </span>
                  {it.snippet && (
                    <span
                      className={`mt-1 line-clamp-2 text-[12.5px] leading-[1.5] ${
                        active ? 'text-text-secondary' : 'text-text-tertiary'
                      }`}
                    >
                      {it.snippet}
                    </span>
                  )}
                </span>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}
