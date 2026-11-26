import { useEffect, useState } from 'react'
import { useToastStore } from '../../stores/toastStore'
import type { CloudStatus } from '../../../../preload/index.d'

const DANGER_BTN =
  'h-[34px] shrink-0 rounded-[9px] bg-bg-mute px-3.5 text-[13px] font-medium text-danger outline-none transition-[filter] hover:brightness-110 disabled:opacity-50'
const PRIMARY_BTN =
  'h-[34px] shrink-0 rounded-[9px] bg-accent-soft px-3.5 text-[13px] font-medium text-accent outline-none transition-[filter] hover:brightness-110 disabled:opacity-50'

/** 설정 > 저장 > Google Drive: 연결 상태와 연결·연결 해제 */
export function CloudSetting(): React.JSX.Element {
  const pushToast = useToastStore((s) => s.push)
  const [status, setStatus] = useState<CloudStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.cloud.getStatus().then(setStatus)
  }, [])

  const connect = async (): Promise<void> => {
    setBusy(true)
    const result = await window.api.cloud.connectGoogle()
    setBusy(false)
    if (result.ok) {
      setStatus(await window.api.cloud.getStatus())
      pushToast({ kind: 'info', message: 'Google Drive에 연결했습니다.' })
    } else {
      pushToast({ kind: 'info', message: result.error })
    }
  }

  const disconnect = async (): Promise<void> => {
    setBusy(true)
    await window.api.cloud.disconnectGoogle()
    setStatus(await window.api.cloud.getStatus())
    setBusy(false)
    pushToast({ kind: 'info', message: 'Google Drive 연결을 해제했습니다.' })
  }

  if (!status) return <div className="h-[76px]" />

  return (
    <div className="flex items-center gap-3.5 p-[18px]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#4cc38a]/15 text-[#7fd6a8]">
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 18a5 5 0 0 1-.6-10 6 6 0 0 1 11.5 1.6A4 4 0 0 1 17 18z" />
        </svg>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13.5px] font-medium text-text">
          {status.connected ? 'Google Drive에 연결되어 있습니다' : 'Google Drive에 연결하지 않았습니다'}
        </span>
        <span className="truncate text-[12.5px] text-text-tertiary">
          {status.connected
            ? (status.email ?? '연결된 계정')
            : status.configured
              ? 'Mdesk가 만든 파일에만 접근합니다'
              : '이 빌드에는 Google 연결 정보가 들어 있지 않습니다'}
        </span>
      </div>
      {status.connected ? (
        <button type="button" disabled={busy} onClick={() => void disconnect()} className={DANGER_BTN}>
          연결 해제
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || !status.configured}
          onClick={() => void connect()}
          className={PRIMARY_BTN}
        >
          {busy ? '로그인하는 중…' : '연결'}
        </button>
      )}
    </div>
  )
}
