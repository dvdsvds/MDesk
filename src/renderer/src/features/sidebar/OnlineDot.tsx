import { useSyncExternalStore } from 'react'

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** 인터넷 연결 여부를 점 색으로 표시한다 */
export function OnlineDot(): React.JSX.Element {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine)
  return (
    <span
      role="status"
      title={online ? '인터넷에 연결되어 있습니다' : '인터넷에 연결되어 있지 않습니다'}
      className="mr-auto flex h-7 w-7 items-center justify-center"
    >
      <span
        className={`h-2 w-2 rounded-full transition-colors ${online ? 'bg-[#2f9e5b]' : 'bg-text-tertiary/60'}`}
      />
    </span>
  )
}
