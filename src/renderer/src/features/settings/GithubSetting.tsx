import { useEffect, useState } from 'react'
import { useToastStore } from '../../stores/toastStore'
import type { GithubStatus } from '../../../../preload/index.d'
import { GithubMark } from '../../components/GithubMark'
import { GITHUB_CHANGED, notifyGithubChanged } from '@renderer/utils/cloudEvents'

const DANGER_BTN =
  'h-[34px] shrink-0 rounded-[9px] bg-bg-mute px-3.5 text-[13px] font-medium text-danger outline-none transition-[filter] hover:brightness-110 disabled:opacity-50'
const PRIMARY_BTN =
  'h-[34px] shrink-0 rounded-[9px] bg-accent-soft px-3.5 text-[13px] font-medium text-accent outline-none transition-[filter] hover:brightness-110 disabled:opacity-50'
const PLAIN_BTN =
  'h-[30px] shrink-0 rounded-[8px] bg-bg px-3 text-[12.5px] font-medium text-text-secondary outline-none transition-colors hover:text-text disabled:opacity-50'

/** 설정 > 저장 > GitHub: 계정 로그인과 연결 해제 */
export function GithubSetting(): React.JSX.Element {
  const pushToast = useToastStore((s) => s.push)
  const [status, setStatus] = useState<GithubStatus | null>(null)
  const [userCode, setUserCode] = useState<string | null>(null)

  useEffect(() => {
    const run = (): void => void window.api.github.getStatus().then(setStatus)
    run()
    window.addEventListener(GITHUB_CHANGED, run)
    return () => window.removeEventListener(GITHUB_CHANGED, run)
  }, [])

  const connect = async (): Promise<void> => {
    const started = await window.api.github.startLogin()
    if (!started.ok) {
      pushToast({ kind: 'info', message: started.error })
      return
    }
    setUserCode(started.userCode)
    const result = await window.api.github.finishLogin()
    setUserCode(null)
    if (result.ok) {
      setStatus(await window.api.github.getStatus())
      pushToast({ kind: 'info', message: 'GitHub에 연결했습니다.' })
      notifyGithubChanged()
    } else {
      pushToast({ kind: 'info', message: result.error })
    }
  }

  const cancel = (): void => {
    void window.api.github.cancelLogin()
    setUserCode(null)
  }

  const disconnect = async (): Promise<void> => {
    await window.api.github.disconnect()
    setStatus(await window.api.github.getStatus())
    pushToast({ kind: 'info', message: 'GitHub 연결을 해제했습니다.' })
    notifyGithubChanged()
  }

  if (!status) return <div className="h-[76px]" />

  return (
    <div className="divide-y divide-border">
      <div className="flex items-center gap-3.5 p-[18px]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-text/10 text-text">
          <GithubMark />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13.5px] font-medium text-text">
            {status.connected
              ? status.login
                ? `GitHub에 ${status.login} 계정으로 연결되어 있습니다`
                : 'GitHub에 연결되어 있습니다'
              : status.configured
                ? 'GitHub에 연결되어 있지 않습니다'
                : 'GitHub에 연결할 수 없습니다'}
          </span>
        </div>
        {status.connected ? (
          <button type="button" onClick={() => void disconnect()} className={DANGER_BTN}>
            연결 해제
          </button>
        ) : userCode ? (
          <button type="button" onClick={cancel} className={DANGER_BTN}>
            취소
          </button>
        ) : (
          <button
            type="button"
            disabled={!status.configured}
            onClick={() => void connect()}
            className={PRIMARY_BTN}
          >
            로그인
          </button>
        )}
      </div>
      {userCode && (
        <div className="flex flex-col gap-2 p-[18px] text-[12.5px] text-text-secondary">
          <span>아래 코드를 입력하십시오.</span>
          <div className="flex items-center gap-2">
            <span className="select-all rounded-lg bg-bg px-3 py-1.5 font-mono text-[16px] font-semibold tracking-[0.15em] text-text">
              {userCode}
            </span>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(userCode)}
              className={PLAIN_BTN}
            >
              복사
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
