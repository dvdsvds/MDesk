import { useEffect, useState } from 'react'

type UpdateStatus = Awaited<ReturnType<typeof window.api.update.getStatus>>

export function UpdateToast(): React.JSX.Element | null {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    let cancelled = false
    void window.api.update.getStatus().then((s) => {
      if (!cancelled) setStatus(s)
    })
    const off = window.api.update.onStatus(setStatus)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  if (status.state === 'idle') return null

  return (
    <div className="fixed bottom-4 left-4 z-50 w-72 rounded-xl border border-border bg-bg-elevated px-4 py-3 text-[13px] text-text shadow-2xl">
      {status.state === 'downloading' ? (
        <>
          <div className="flex items-center justify-between">
            <span>새 버전 {status.version}을(를) 받는 중이에요</span>
            <span className="tabular-nums text-text-secondary">{status.percent}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${status.percent}%` }}
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span>새 버전 {status.version}을(를) 받았어요</span>
          <button
            type="button"
            onClick={() => void window.api.update.install()}
            className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-[12px] text-white hover:opacity-90"
          >
            재시작
          </button>
        </div>
      )}
    </div>
  )
}
