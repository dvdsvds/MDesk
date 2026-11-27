export const INPUT =
  'h-7 rounded-lg bg-text/[0.07] px-2.5 text-[13px] text-text outline-none transition-shadow focus:ring-1 focus:ring-accent/60'

export function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-[14px] bg-bg-mute/60">
      {children}
    </div>
  )
}

export function Row({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-[54px] items-center justify-between gap-4 px-[18px] text-[13.5px] text-text">
      <span>{label}</span>
      {children}
    </div>
  )
}

/** − / + 버튼으로 값을 바꾸는 칸 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min,
  max,
  label,
  format = (v) => String(v)
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min: number
  max: number
  label: string
  format?: (v: number) => string
}): React.JSX.Element {
  const clamp = (v: number): number => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  const BTN =
    'flex h-[34px] w-[34px] items-center justify-center text-[16px] text-text-secondary outline-none transition-colors hover:text-text disabled:opacity-30'
  return (
    <div className="flex h-[34px] items-center rounded-[9px] bg-bg">
      <button
        type="button"
        aria-label={`${label} 줄이기`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={BTN}
      >
        −
      </button>
      <span className="w-11 text-center font-mono text-[12.5px] text-text">{format(value)}</span>
      <button
        type="button"
        aria-label={`${label} 늘리기`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={BTN}
      >
        +
      </button>
    </div>
  )
}

export function NumberField({
  value,
  onChange,
  step = 1,
  min,
  max
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}): React.JSX.Element {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (!Number.isNaN(n)) onChange(n)
      }}
      className={`${INPUT} w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
    />
  )
}

export function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-5 w-[34px] shrink-0 rounded-full outline-none transition-colors ${
        checked ? 'bg-accent' : 'bg-text/20'
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-3.5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export function Checkbox({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: () => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="group flex items-center gap-2.5 outline-none"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors ${
          checked ? 'border-accent bg-accent' : 'border-text/30 group-hover:border-text/50'
        }`}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-bg transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}
        >
          <path d="M2 5.3l2 2L8 3" />
        </svg>
      </span>
      {label}
    </button>
  )
}

export function SubRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-[38px] items-center border-t border-border pl-10 pr-3.5 text-[13px] text-text-secondary">
      {children}
    </div>
  )
}