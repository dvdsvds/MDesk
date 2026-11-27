import { useCallback, useEffect, useState } from 'react'
import type { GithubLinkView } from '../../../../preload/index.d'
import { ContextMenu, type ContextMenuItem } from '../../components/ContextMenu'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { Collapse } from '../../components/Collapse'
import { useToastStore } from '../../stores/toastStore'
import { GITHUB_CHANGED, notifyGithubChanged } from '@renderer/utils/cloudEvents'
import TrashIcon from '../../icons/ctx-trash.svg?react'
import RevealIcon from '../../icons/ctx-reveal.svg?react'
import ExportIcon from '../../icons/ctx-export.svg?react'
import { SectionHeader } from './SectionHeader'
import { GithubPickDialog } from './GithubPickDialog'

const ROW_BASE =
  'flex h-[30px] w-full items-center gap-1.5 rounded-md pr-8 text-left text-[13px] text-text transition-colors group-hover/row:bg-bg-mute/60 focus:outline-none'
const MENU_BTN =
  'flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-text-tertiary outline-none hover:bg-bg-mute hover:text-text disabled:opacity-30'
const SECTION_HEADER_BASIS = '37px'

function Chevron({ open }: { open: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 text-text-tertiary transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
    >
      <path
        d="M6 3.5L10.5 8L6 12.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Dots(): React.JSX.Element {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="3.5" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12.5" cy="8" r="1.3" />
    </svg>
  )
}

type LinkFile = GithubLinkView['files'][number]

interface DirNode {
  name: string
  path: string
  dirs: DirNode[]
  files: LinkFile[]
}

/** 저장소 안 경로로 폴더 트리를 만든다. md 파일이 없는 폴더가 하나씩 이어지면 a/b처럼 한 줄로 합치고, md 파일이 있는 폴더는 따로 둔다 */
function buildTree(files: LinkFile[]): DirNode {
  const root: DirNode = { name: '', path: '', dirs: [], files: [] }
  for (const file of files) {
    const parts = file.path.split('/')
    let node = root
    for (const part of parts.slice(0, -1)) {
      const path = node.path ? `${node.path}/${part}` : part
      let next = node.dirs.find((d) => d.name === part)
      if (!next) {
        next = { name: part, path, dirs: [], files: [] }
        node.dirs.push(next)
      }
      node = next
    }
    node.files.push(file)
  }
  const sort = (n: DirNode): void => {
    n.dirs.sort((a, b) => a.name.localeCompare(b.name))
    n.files.sort((a, b) => a.path.localeCompare(b.path))
    n.dirs.forEach(sort)
  }
  const compact = (n: DirNode): void => {
    n.dirs = n.dirs.map((d) => {
      let dir = d
      while (dir.files.length === 0 && dir.dirs.length === 1 && dir.dirs[0].files.length === 0) {
        const child = dir.dirs[0]
        dir = { ...child, name: `${dir.name}/${child.name}` }
      }
      compact(dir)
      return dir
    })
  }
  sort(root)
  compact(root)
  return root
}

interface Props {
  open: boolean
  onToggle: () => void
  onOpenFile: (filePath: string) => void
  activeFilePath: string | null
  dirtyFilePaths: string[]
}

/** 사이드바 GitHub 섹션: 저장소의 md 파일과 커밋 */
export function GithubSection({
  open,
  onToggle,
  onOpenFile,
  activeFilePath,
  dirtyFilePaths
}: Props): React.JSX.Element {
  const pushToast = useToastStore((s) => s.push)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [links, setLinks] = useState<GithubLinkView[]>([])
  const [userCode, setUserCode] = useState<string | null>(null)
  const [closedRepos, setClosedRepos] = useState<Set<string>>(new Set())
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set())
  const [picking, setPicking] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; link: GithubLinkView } | null>(null)
  const [committing, setCommitting] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async (): Promise<void> => {
    const [status, list] = await Promise.all([
      window.api.github.getStatus(),
      window.api.github.listLinks()
    ])
    setConnected(status.connected)
    setAccount(status.login)
    setAvatar(status.avatar)
    setLinks(list)
  }, [])

  useEffect(() => {
    let alive = true
    const run = (): void => {
      void Promise.all([window.api.github.getStatus(), window.api.github.listLinks()]).then(
        ([status, list]) => {
          if (!alive) return
          setConnected(status.connected)
          setAccount(status.login)
          setAvatar(status.avatar)
          setLinks(list)
        }
      )
    }
    run()
    window.addEventListener(GITHUB_CHANGED, run)
    const off = window.api.github.onSaved(run)
    return () => {
      alive = false
      window.removeEventListener(GITHUB_CHANGED, run)
      off()
    }
  }, [])

  const login = async (): Promise<void> => {
    const started = await window.api.github.startLogin()
    if (!started.ok) {
      pushToast({ kind: 'info', message: started.error })
      return
    }
    setUserCode(started.userCode)
    const result = await window.api.github.finishLogin()
    setUserCode(null)
    if (!result.ok) {
      pushToast({ kind: 'info', message: result.error })
      return
    }
    notifyGithubChanged()
  }

  const cancelLogin = (): void => {
    void window.api.github.cancelLogin()
    setUserCode(null)
  }

  const removeLink = async (link: GithubLinkView): Promise<void> => {
    if (link.files.some((f) => f.changed)) {
      pushToast({ kind: 'info', message: 'GitHub에 올리지 않은 수정 내용이 있습니다.' })
      return
    }
    await window.api.github.removeLink(link.id)
    await reload()
  }

  const startCommit = (link: GithubLinkView): void => {
    if (!link.files.some((f) => f.changed)) {
      pushToast({ kind: 'info', message: '수정한 파일이 없습니다.' })
      return
    }
    if (link.files.some((f) => dirtyFilePaths.includes(f.localPath))) {
      pushToast({ kind: 'info', message: '저장하지 않은 파일이 있어 올릴 수 없습니다.' })
      return
    }
    setMessage('')
    setCommitting(link.id)
  }

  const commit = async (link: GithubLinkView): Promise<void> => {
    const text = message.trim()
    if (!text || busy) return
    setBusy(true)
    const result = await window.api.github.commit(link.id, text)
    setBusy(false)
    if (!result.ok) {
      pushToast({ kind: 'info', message: result.error })
      return
    }
    setCommitting(null)
    pushToast({ kind: 'info', message: `파일 ${result.count}개를 GitHub에 올렸습니다.` })
    await reload()
  }

  const toggleSet = (setter: typeof setOpenDirs, key: string): void => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const menuItems = (link: GithubLinkView): ContextMenuItem[] => [
    {
      label: 'GitHub에 올리기',
      icon: <ExportIcon width={15} height={15} />,
      onClick: () => startCommit(link)
    },
    {
      label: 'GitHub에서 보기',
      icon: <RevealIcon width={15} height={15} />,
      onClick: () => window.open(`https://github.com/${link.owner}/${link.repo}`, '_blank')
    },
    {
      label: '저장소 제거',
      icon: <TrashIcon width={15} height={15} />,
      danger: true,
      sepBefore: true,
      onClick: () => void removeLink(link)
    }
  ]

  /** 폴더를 펼치면 md 파일이 나올 때까지 그 아래 폴더도 함께 펼친다 */
  const toggleDir = (link: GithubLinkView, dir: DirNode): void => {
    const key = `${link.id}/${dir.path}`
    setOpenDirs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        return next
      }
      const openDown = (node: DirNode): void => {
        next.add(`${link.id}/${node.path}`)
        if (node.files.length === 0) node.dirs.forEach(openDown)
      }
      openDown(dir)
      return next
    })
  }

  const renderFile = (file: LinkFile, depth: number): React.JSX.Element => {
    const name =
      file.path
        .split('/')
        .pop()
        ?.replace(/\.(md|markdown)$/i, '') ?? file.path
    const active = activeFilePath === file.localPath
    return (
      <div key={file.path} className="group/row">
        <button
          type="button"
          onClick={() => onOpenFile(file.localPath)}
          aria-current={active ? 'true' : undefined}
          className={`${ROW_BASE} ${active ? '!bg-bg-mute font-medium' : ''}`}
          style={{ paddingLeft: 6 + depth * 16 }}
          title={file.path}
        >
          <span className="w-3.5 shrink-0" />
          <FileTypeIcon name={file.path} kind="file" />
          <span className="truncate">{name}</span>
          {file.changed && (
            <span
              aria-label="수정됨"
              className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
            />
          )}
        </button>
      </div>
    )
  }

  const renderDir = (link: GithubLinkView, node: DirNode, depth: number): React.ReactNode => (
    <>
      {node.dirs.map((dir) => {
        const key = `${link.id}/${dir.path}`
        const isOpen = openDirs.has(key)
        return (
          <div key={key}>
            <div className="group/row">
              <button
                type="button"
                onClick={() => toggleDir(link, dir)}
                className={ROW_BASE}
                style={{ paddingLeft: 6 + depth * 16 }}
              >
                <Chevron open={isOpen} />
                <FileTypeIcon name={dir.name} kind="folder" open={isOpen} />
                <span className="truncate">{dir.name}</span>
              </button>
            </div>
            <Collapse open={isOpen}>{renderDir(link, dir, depth + 1)}</Collapse>
          </div>
        )
      })}
      {node.files.map((file) => renderFile(file, depth))}
    </>
  )

  const renderLink = (link: GithubLinkView): React.JSX.Element => {
    const isOpen = !closedRepos.has(link.id)
    const changedCount = link.files.filter((f) => f.changed).length
    return (
      <div key={link.id}>
        <div className="group/row relative">
          <button
            type="button"
            onClick={() => toggleSet(setClosedRepos, link.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ x: e.clientX, y: e.clientY, link })
            }}
            className={`${ROW_BASE} ${changedCount > 0 ? '!pr-[76px]' : ''}`}
            style={{ paddingLeft: 6 }}
            title={`${link.owner}/${link.repo}`}
          >
            <Chevron open={isOpen} />
            <FileTypeIcon name={link.repo} kind="folder" open={isOpen} />
            <span className="truncate">{link.repo}</span>
          </button>
          <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {changedCount > 0 && (
              <button
                type="button"
                onClick={() => startCommit(link)}
                title="GitHub에 올리기"
                className="flex h-[22px] items-center rounded-[5px] px-1.5 text-[11.5px] font-medium text-accent outline-none hover:bg-bg-mute"
              >
                올리기 {changedCount}
              </button>
            )}
            <button
              type="button"
              aria-label={`${link.repo} 메뉴`}
              title="메뉴"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setMenu({ x: r.left, y: r.bottom + 4, link })
              }}
              className={MENU_BTN}
            >
              <Dots />
            </button>
          </span>
        </div>
        {committing === link.id && (
          <form
            className="py-1 pr-1"
            style={{ paddingLeft: 26 }}
            onSubmit={(e) => {
              e.preventDefault()
              void commit(link)
            }}
          >
            <input
              autoFocus
              value={message}
              disabled={busy}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCommitting(null)
              }}
              onBlur={() => {
                if (!busy && !message.trim()) setCommitting(null)
              }}
              placeholder={busy ? '올리는 중…' : '커밋 메시지'}
              className="h-7 w-full rounded-md border border-accent/60 bg-bg px-2 text-[12.5px] text-text outline-none"
            />
          </form>
        )}
        <Collapse open={isOpen}>{renderDir(link, buildTree(link.files), 1)}</Collapse>
      </div>
    )
  }

  return (
    <div
      className="group/github flex min-h-0 flex-col overflow-hidden border-t border-border transition-[flex-grow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ flexGrow: open ? 1 : 0, flexShrink: 1, flexBasis: SECTION_HEADER_BASIS }}
    >
      <div className="flex h-9 shrink-0 items-center justify-between pl-2 pr-2">
        <SectionHeader label="GitHub" open={open} onToggle={onToggle} />
        {connected && (
          <button
            type="button"
            onClick={() => void reload()}
            title="새로고침"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-text-secondary opacity-0 transition-[opacity,colors] duration-150 hover:bg-bg-mute hover:text-text group-focus-within/github:opacity-100 group-hover/github:opacity-100"
          >
            <span className="text-[14px] leading-none">↻</span>
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2" inert={!open}>
        {connected && account && !userCode && (
          <a
            href={`https://github.com/${account}`}
            target="_blank"
            rel="noreferrer"
            title="GitHub 프로필 열기"
            className="mx-1 mb-1 flex h-7 items-center gap-2 rounded-md px-1 text-[12px] text-text-secondary outline-none transition-colors hover:bg-bg-mute/60 hover:text-text"
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-[18px] w-[18px] shrink-0 rounded-full" />
            ) : (
              <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-bg-mute" />
            )}
            <span className="truncate">{account}</span>
          </a>
        )}
        {userCode ? (
          <div className="px-2 py-1 text-[12.5px] text-text-tertiary">
            브라우저에 열린 GitHub 페이지에 아래 코드를 입력하십시오.
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="flex h-8 flex-1 select-all items-center justify-center rounded-lg bg-bg-mute font-mono text-[14px] font-semibold tracking-[0.12em] text-text">
                {userCode}
              </span>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(userCode)}
                className="h-8 rounded-lg bg-bg-mute px-2.5 text-[12.5px] text-text-secondary outline-none hover:text-text"
              >
                복사
              </button>
            </div>
            <button
              type="button"
              onClick={cancelLogin}
              className="mt-1.5 flex h-8 w-full items-center justify-center rounded-lg text-[12.5px] text-text-secondary outline-none hover:bg-bg-mute hover:text-text"
            >
              취소
            </button>
          </div>
        ) : connected === null ? null : !connected || links.length === 0 ? (
          <div className="px-2 py-1 text-[12.5px] text-text-tertiary">
            {connected ? '저장소가 없습니다' : 'GitHub 연결을 위해 로그인이 필요합니다.'}
            <button
              type="button"
              onClick={connected ? () => setPicking(true) : () => void login()}
              className="mt-2.5 flex h-8 w-full items-center justify-center rounded-lg bg-accent-soft text-[13px] font-medium text-accent outline-none hover:brightness-110"
            >
              {connected ? '저장소 추가' : '로그인'}
            </button>
          </div>
        ) : (
          <>
            {links.map(renderLink)}
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="mt-2 flex h-8 w-full items-center justify-center rounded-lg bg-accent-soft text-[13px] font-medium text-accent outline-none hover:brightness-110"
            >
              저장소 추가
            </button>
          </>
        )}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.link)}
          onClose={() => setMenu(null)}
        />
      )}
      {picking && (
        <GithubPickDialog
          linked={links}
          onCancel={() => setPicking(false)}
          onDone={() => {
            setPicking(false)
            void reload()
          }}
        />
      )}
    </div>
  )
}
