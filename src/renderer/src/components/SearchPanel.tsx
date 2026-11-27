import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { FileTypeIcon } from './FileTypeIcon'
import { fileNameOf, folderTrail } from '@renderer/utils/path'

interface SearchResult {
  path: string
  title: string
  snippet: string | null
}

interface SearchPanelProps {
  rootDir: string | null
  onOpenFile: (filePath: string) => void
  onClose: () => void
}

const MAX_LIST_HEIGHT = 360
const MAX_RESULTS = 10

function Highlight({ text, query }: { text: string; query: string }): React.JSX.Element {
  const q = query.trim()
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <b className="font-semibold text-accent">{text.slice(i, i + q.length)}</b>
      {text.slice(i + q.length)}
    </>
  )
}

function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="rounded-[5px] bg-bg-mute px-1.5 py-px font-mono text-text-secondary">{children}</span>
}

export function SearchPanel({ rootDir, onOpenFile, onClose }: SearchPanelProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    const t = window.setTimeout(
      () => {
        void window.api.workspace.search({ text, folder: null }).then((r) => {
          if (cancelled) return
          setResults(r.slice(0, MAX_RESULTS))
          setActive(0)
        })
      },
      text ? 150 : 0
    )
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [text])

  useEffect(() => {
    rowRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const open = (r: SearchResult): void => {
    onOpenFile(r.path)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length > 0) setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length > 0) setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      const r = results[active]
      if (r) open(r)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[104px] bg-[rgba(8,9,12,0.45)] backdrop-blur-[10px]"
      style={{ willChange: 'opacity' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-label="검색"
        onClick={(e) => e.stopPropagation()}
        style={{ willChange: 'transform, opacity' }}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
        className="flex w-[660px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[18px] border border-white/[0.07] bg-bg-elevated"
      >
        <label className="flex h-16 items-center gap-3.5 px-[22px]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="shrink-0 text-text-tertiary"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="4.9" />
            <path d="M11.6 11.6L15.5 15.5" />
          </svg>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="파일 이름이나 내용을 검색합니다"
            placeholder="파일 이름이나 내용을 검색합니다…"
            className="min-w-0 flex-1 bg-transparent text-[17px] text-text outline-none placeholder:text-text-tertiary"
          />
        </label>
        <div className="h-px bg-white/[0.06]" />

        <div className="overflow-y-auto" style={{ maxHeight: MAX_LIST_HEIGHT }}>
          <div className="flex flex-col gap-0.5 px-3 pb-1.5 pt-3">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-text-tertiary">
                일치하는 파일이 없습니다
              </p>
            ) : (
              results.map((r, i) => {
                const on = i === active
                return (
                  <button
                    key={r.path}
                    ref={(el) => {
                      rowRefs.current[i] = el
                    }}
                    type="button"
                    onClick={() => open(r)}
                    onMouseMove={() => active !== i && setActive(i)}
                    className={`flex h-12 w-full shrink-0 items-center gap-3 rounded-xl px-3 text-left outline-none ${
                      on ? 'bg-accent/15 shadow-[inset_0_0_0_1px_rgba(110,155,255,0.35)]' : ''
                    }`}
                  >
                    <span
                      className={`flex size-[30px] shrink-0 items-center justify-center rounded-[9px] ${
                        on ? 'bg-accent/15' : 'bg-accent/10'
                      }`}
                    >
                      <FileTypeIcon name={fileNameOf(r.path)} kind="file" size={18} raise={false} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className={`truncate text-[13.5px] text-text ${on ? 'font-medium' : ''}`}>
                        <Highlight text={r.title} query={text} />
                      </span>
                      <span className="truncate text-[11.5px] text-text-tertiary">
                        {folderTrail(rootDir, r.path)}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex h-10 items-center gap-4 border-t border-white/[0.05] bg-bg px-[22px] text-[11.5px] text-text-tertiary">
          <span>
            <Kbd>↑↓</Kbd> 이동
          </span>
          <span>
            <Kbd>Enter</Kbd> 열기
          </span>
          <span>
            <Kbd>Esc</Kbd> 닫기
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}
