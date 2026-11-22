import { useEffect, useState } from 'react'
import { useToastStore } from '../../stores/toastStore'
import type { CloudStatus } from '../../../../preload/index.d'

const BTN =
  'h-8 rounded-lg bg-bg-mute px-3 text-[13px] text-text-secondary outline-none transition-colors hover:text-text disabled:opacity-50'
const PRIMARY =
  'h-8 rounded-lg bg-accent-soft px-3 text-[13px] font-medium text-accent outline-none transition-[filter] hover:brightness-110 disabled:opacity-50'

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
      pushToast({ kind: 'info', message: 'Google Drive에 연결했어요.' })
    } else {
      pushToast({ kind: 'info', message: result.error })
    }
  }

  const disconnect = async (): Promise<void> => {
    setBusy(true)
    await window.api.cloud.disconnectGoogle()
    setStatus(await window.api.cloud.getStatus())
    setBusy(false)
    pushToast({ kind: 'info', message: 'Google Drive 연결을 해제했어요.' })
  }

  if (!status) return <div className="px-3.5 py-3" />

  return (
    <div className="px-3.5 py-3">
      <div className="text-[13.5px] text-text">
        {status.connected ? 'Google Drive에 연결되어 있어요' : 'Google Drive에 연결하지 않았어요'}
      </div>
      <div className="mt-1 text-[12.5px] text-text-tertiary">
        {status.connected
          ? (status.email ?? '연결된 계정')
          : 'Mdesk가 만든 파일에만 접근하고, 다른 Drive 파일은 볼 수 없어요'}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        {status.connected ? (
          <button type="button" disabled={busy} onClick={() => void disconnect()} className={BTN}>
            연결 해제
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !status.configured}
            onClick={() => void connect()}
            className={PRIMARY}
          >
            {busy ? '브라우저에서 로그인하는 중…' : 'Google Drive 연결'}
          </button>
        )}
      </div>
      {!status.configured && (
        <div className="mt-2 text-[12.5px] text-text-tertiary">
          이 빌드에는 Google 연결 정보가 들어 있지 않아요
        </div>
      )}
    </div>
  )
}
