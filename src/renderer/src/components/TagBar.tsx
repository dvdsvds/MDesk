import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNotePropsStore } from '../stores/notePropsStore'
import {
  PROPERTY_COLORS,
  STATUS_OPTIONS,
  joinTags,
  splitTags,
  statusOf
} from '../utils/noteProperties'

/** 알약 하나의 높이. 입력 중에도 같은 높이를 써서 태그 줄 높이가 바뀌지 않게 한다 */
const PILL = 'flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-medium'

/** 태그가 생기고 없어질 때, 입력란이 열리고 닫힐 때 쓰는 움직임 */
const POP = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.85 },
  transition: { duration: 0.16, ease: [0.4, 0, 0.2, 1] as const }
}

/**
 * 에디터 위 태그 줄.
 * 앞에는 상태(대기·진행·보류·완료) 알약이 늘 보이고 누르면 그 상태로 바뀐다.
 * 그 뒤에 직접 만든 태그, 맨 끝에 태그 추가 알약이 있다.
 * 태그 추가 알약에 포커스가 가면 입력란이 되고, Enter로 태그를 만들고, 비어 있을 때 Backspace로 마지막 태그를 지운다
 */
export function TagBar({ filePath }: { filePath: string }): React.JSX.Element {
  const props = useNotePropsStore((s) => s.byPath[filePath])
  const setProps = useNotePropsStore((s) => s.setProps)
  const current = statusOf(props?.status)
  const tags = splitTags(props?.tags)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const setTags = (next: string[]): void => setProps(filePath, { tags: joinTags(next) || null })

  const addTag = (): void => {
    const name = text.trim()
    setText('')
    if (!name || tags.includes(name)) return
    setTags([...tags, name])
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
      {STATUS_OPTIONS.map((o) => {
        const on = o.label === current.label
        const c = PROPERTY_COLORS[o.color]
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={on}
            title={`상태: ${o.label}`}
            onClick={() => setProps(filePath, { status: o.label })}
            className={`${PILL} outline-none transition-[opacity,transform] duration-150 active:scale-95 focus-visible:ring-1 focus-visible:ring-accent ${on ? '' : 'opacity-45 hover:opacity-80'}`}
            style={{ background: `${c}26`, color: c }}
          >
            {o.label}
          </button>
        )
      })}
      <AnimatePresence initial={false} mode="popLayout">
        {tags.length > 0 && (
          <motion.span key="sep" layout {...POP} className="mx-0.5 h-3.5 w-px shrink-0 bg-border" />
        )}
        {tags.map((t) => (
          <motion.span
            key={`tag-${t}`}
            layout
            {...POP}
            className={`${PILL} bg-bg-mute text-text-secondary`}
          >
            {t}
          </motion.span>
        ))}
        {editing ? (
          <motion.input
            key="input"
            layout
            {...POP}
            ref={inputRef}
            autoFocus
            value={text}
            aria-label="태그 이름"
            placeholder="태그 이름"
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              addTag()
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              } else if (e.key === 'Backspace' && text === '' && tags.length > 0) {
                e.preventDefault()
                setTags(tags.slice(0, -1))
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setText('')
                inputRef.current?.blur()
              }
            }}
            className={`${PILL} w-28 border border-dashed border-accent/60 bg-transparent text-text outline-none placeholder:text-text-tertiary`}
          />
        ) : (
          <motion.button
            key="add"
            layout
            {...POP}
            type="button"
            onFocus={() => setEditing(true)}
            onClick={() => setEditing(true)}
            className={`${PILL} gap-1 border border-dashed border-border-strong text-text-tertiary outline-none hover:text-text-secondary`}
          >
            <svg
              aria-hidden="true"
              width="11"
              height="11"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            태그 추가
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
