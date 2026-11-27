import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSettingsStore } from '../../stores/settingsStore'
import { Toggle } from './SettingsParts'

const VIM_KEYS: { group: string; keys: [string, string][] }[] = [
  {
    group: '모드',
    keys: [
      ['i', '입력 모드'],
      ['v', '선택 모드'],
      ['Esc', '일반 모드']
    ]
  },
  {
    group: '이동',
    keys: [
      ['h j k l', '왼쪽 아래 위 오른쪽'],
      ['w b', '다음 낱말, 이전 낱말'],
      ['gg G', '문서 처음, 문서 끝']
    ]
  },
  {
    group: '편집',
    keys: [
      ['dd', '줄 삭제'],
      ['yy', '줄 복사'],
      ['p', '붙여넣기'],
      ['u', '실행 취소']
    ]
  },
  {
    group: '찾기',
    keys: [
      ['/', '찾기'],
      ['n', '다음 결과']
    ]
  },
  { group: '명령', keys: [[':w', '저장']] }
]

function Keycap({ children }: { children: string }): React.JSX.Element {
  return (
    <kbd className="inline-flex h-[22px] min-w-5 items-center justify-center rounded-[5px] bg-bg px-1.5 font-mono text-[11px] text-text shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
      {children}
    </kbd>
  )
}

/** 설정 > 에디터 > Vim: 켜고 끄는 스위치. 켜 두면 키 목록을 펼쳐 볼 수 있다 */
export function VimSetting(): React.JSX.Element {
  const vimMode = useSettingsStore((s) => s.vimMode)
  const setVimMode = useSettingsStore((s) => s.setVimMode)
  const [open, setOpen] = useState(true)
  const expanded = vimMode && open

  return (
    <div>
      <div className="flex min-h-[54px] items-center gap-2 px-[18px] text-[13.5px] text-text">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label="Vim 키 바인딩 펼치기"
          disabled={!vimMode}
          onClick={() => setOpen(!open)}
          className="-ml-1 flex h-[22px] w-[22px] items-center justify-center rounded-md text-text-tertiary outline-none disabled:opacity-40"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          >
            <path
              d="M6 3.5L10.5 8L6 12.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        Vim
        <span className="ml-auto">
          <Toggle checked={vimMode} onChange={() => setVimMode(!vimMode)} />
        </span>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="vim-keys"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border px-[18px] pb-4 pl-11 pt-1.5">
              {VIM_KEYS.map(({ group, keys }) => (
                <div key={group} className="flex flex-col">
                  <span className="mb-1 text-[11.5px] font-semibold text-text-tertiary">
                    {group}
                  </span>
                  {keys.map(([k, desc]) => (
                    <div key={k} className="flex h-7 items-center gap-2.5">
                      <span className="flex w-[92px] shrink-0 gap-[3px]">
                        {k.split(' ').map((part) => (
                          <Keycap key={part}>{part}</Keycap>
                        ))}
                      </span>
                      <span className="text-[12.5px] text-text-secondary">{desc}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
