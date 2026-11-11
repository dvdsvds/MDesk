import { useEffect, useState } from 'react'
import WindowCloseIcon from '../icons/window-close.svg?react'
import WindowMaximizeIcon from '../icons/window-maximize.svg?react'
import WindowMinimizeIcon from '../icons/window-minimize.svg?react'
import WindowRestoreIcon from '../icons/window-restore.svg?react'

interface TitleBarProps {
  /** 왼쪽 칸(아이콘 줄·사이드바 위). 폭과 내용은 부르는 쪽이 정한다 */
  left?: React.ReactNode
  /** 가운데(탭). 남는 폭을 다 쓰고, 빈 곳은 창 끌기 영역이다 */
  children?: React.ReactNode
  /** 창 버튼 바로 앞에 붙일 버튼 */
  right?: React.ReactNode
  /** 타이틀바 한가운데(창 가운데 기준)에 놓을 것 */
  center?: React.ReactNode
}

function WindowControls(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    void window.api.window.isMaximized().then(setIsMaximized)
    return window.api.window.onMaximizedChanged(setIsMaximized)
  }, [])

  return (
    <div className="titlebar-no-drag flex h-9 items-center gap-0.5 px-1.5">
      <button
        type="button"
        onClick={() => void window.api.window.minimize()}
        title="최소화"
        className="flex h-7 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-mute hover:text-text"
      >
        <WindowMinimizeIcon />
      </button>
      <button
        type="button"
        onClick={() => void window.api.window.toggleMaximize()}
        title={isMaximized ? '이전 크기로' : '최대화'}
        className="flex h-7 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-mute hover:text-text"
      >
        {isMaximized ? <WindowRestoreIcon /> : <WindowMaximizeIcon />}
      </button>
      <button
        type="button"
        onClick={() => void window.api.window.close()}
        aria-label="닫기"
        className="flex h-7 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-[#e81123] hover:text-white"
      >
        <WindowCloseIcon />
      </button>
    </div>
  )
}

export function TitleBar({ left, children, right, center }: TitleBarProps): React.JSX.Element {
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null)

  useEffect(() => {
    void window.api.window.platform().then(setPlatform)
  }, [])

  const isMac = platform === 'darwin'

  return (
    <header
      className={`titlebar-drag relative flex h-9 shrink-0 items-center ${isMac ? 'flex-row-reverse' : ''}`}
      onDoubleClick={() => void window.api.window.toggleMaximize()}
    >
      {left}
      {center && (
        <div
          className="titlebar-no-drag absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {center}
        </div>
      )}
      {/* 탭은 no-drag라 두 번 누르기가 여기까지 올라온다. 창 최대화로 번지지 않게 막는다.
          오른쪽 40px는 탭이 많아도 늘 비워 둔다. 마지막 탭의 ×와 창 버튼이 붙어 잘못 누르지 않게(창 끌기 영역도 남는다) */}
      <div
        className="flex min-w-0 flex-1 items-center pr-10"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
      {right && (
        <div
          className={`titlebar-no-drag flex items-center gap-0.5 ${isMac ? 'flex-row-reverse px-2' : ''}`}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {right}
          <span className="mx-2 h-4 w-px bg-border" />
        </div>
      )}
      {platform && (
        <div onDoubleClick={(e) => e.stopPropagation()}>
          <WindowControls />
        </div>
      )}
    </header>
  )
}
