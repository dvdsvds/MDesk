import { useEffect, useState } from 'react'
import WindowCloseIcon from '../icons/window-close.svg?react'
import WindowMaximizeIcon from '../icons/window-maximize.svg?react'
import WindowMinimizeIcon from '../icons/window-minimize.svg?react'
import WindowRestoreIcon from '../icons/window-restore.svg?react'

interface TitleBarProps {
  left?: React.ReactNode
  children?: React.ReactNode
  right?: React.ReactNode
  center?: React.ReactNode
}

export function WindowControls(): React.JSX.Element {
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
