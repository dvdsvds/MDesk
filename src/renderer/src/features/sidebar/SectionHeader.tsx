import ChevronIcon from '../../icons/chevron.svg?react'

export function SectionHeader({
  label,
  open,
  onToggle
}: {
  label: string
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-[26px] items-center gap-1 rounded-md pl-1 pr-2 text-[11px] font-medium tracking-wide text-text-tertiary transition-colors hover:text-text-secondary"
    >
      <ChevronIcon
        width={12}
        height={12}
        className="shrink-0 transition-transform"
        style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
      />
      {label}
    </button>
  )
}
