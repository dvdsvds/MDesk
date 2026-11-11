import type { ViewMode } from '../stores/settingsStore'

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

function PencilIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

function SplitIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M12 4v16" />
    </svg>
  )
}

function MonitorIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
      <path d="M8 21h8M12 16.5V21" />
    </svg>
  )
}

const MODES: { mode: ViewMode; label: string; Icon: () => React.JSX.Element }[] = [
  { mode: 'editor', label: '에디터', Icon: PencilIcon },
  { mode: 'split', label: '분할', Icon: SplitIcon },
  { mode: 'preview', label: '미리보기', Icon: MonitorIcon }
]

/** 타이틀바 가운데의 보기 모드 전환: 에디터만 / 분할 / 미리보기만 */
export function ViewModeSwitch({
  value,
  onChange,
  shortcuts
}: {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  /** 모드별 단축키. 마우스를 올리면 이름 옆에 보인다 */
  shortcuts?: Record<ViewMode, string>
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5">
      {MODES.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          title={shortcuts?.[mode] ? `${label} (${shortcuts[mode]})` : label}
          aria-pressed={value === mode}
          className={`flex h-6 w-9 items-center justify-center rounded-md transition-colors ${
            value === mode
              ? 'bg-accent/20 text-accent'
              : 'text-text-secondary hover:bg-bg-mute hover:text-text'
          }`}
        >
          <Icon />
        </button>
      ))}
    </div>
  )
}
