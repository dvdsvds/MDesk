import { useCallback, useEffect, useRef, useState } from 'react'
import type { DriveItem, DriveResult } from '../../../../preload/index.d'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextMenu, type ContextMenuItem } from '../../components/ContextMenu'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { Collapse } from '../../components/Collapse'
import { useTabsStore } from '../../stores/tabsStore'
import { useToastStore } from '../../stores/toastStore'
import { fileNameOf, newFileNameFor, sepOf } from '@renderer/utils/path'
import RenameIcon from '../../icons/ctx-rename.svg?react'
import TrashIcon from '../../icons/ctx-trash.svg?react'
import NewFileIcon from '../../icons/new-file.svg?react'
import NewFolderIcon from '../../icons/new-folder.svg?react'
import { InlineNameInput, NewFileRow } from './InlineInputs'
import { SectionHeader } from './SectionHeader'
import { GOOGLE_STATUS_CHANGED, notifyGoogleStatusChanged } from '@renderer/utils/cloudEvents'

const ROW_BASE =
  'flex h-[30px] w-full items-center gap-1.5 rounded-md pr-8 text-left text-[13px] text-text transition-colors group-hover/row:bg-bg-mute/60 focus:outline-none'

const ROW_ACTION =
  'flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-text-tertiary outline-none hover:bg-bg-mute hover:text-text'

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
const ICON_BTN =
  'flex h-[26px] w-[26px] items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-mute hover:text-text disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary'
const ROOT = 'root'

interface Listing {
  items: DriveItem[]
}

type Creating = { parent: string | null; kind: 'file' | 'folder' } | null

const SECTION_HEADER_BASIS = '37px'

interface Props {
  open: boolean
  onToggle: () => void
  onOpenFile: (filePath: string) => void
  draggingLocalPath: string | null
  dirtyFilePaths: string[]
  onLocalMoved: (sourcePath: string, moved: { from: string; to: string }[]) => Promise<void>
  activeFilePath: string | null
}

const keyOf = (id: string | null): string => id ?? ROOT

export function DriveSection({
  open,
  onToggle,
  onOpenFile,
  draggingLocalPath,
  dirtyFilePaths,
  onLocalMoved,
  activeFilePath
}: Props): React.JSX.Element {
  const pushToast = useToastStore((s) => s.push)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [listings, setListings] = useState<Record<string, Listing>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [creating, setCreating] = useState<Creating>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; item: DriveItem } | null>(null)
  const [rootMenu, setRootMenu] = useState<{ x: number; y: number } | null>(null)
  const [deleting, setDeleting] = useState<DriveItem | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [movingIn, setMovingIn] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const expandedRef = useRef(expanded)
  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])

  const report = useCallback(
    (result: Extract<DriveResult<object>, { ok: false }>): void => {
      if (result.notConnected) setConnected(false)
      pushToast({ kind: 'info', message: result.error })
    },
    [pushToast]
  )

  const applyList = useCallback(
    (folderId: string | null, result: DriveResult<{ items: DriveItem[] }>): void => {
      if (!result.ok) {
        if (result.notConnected) setConnected(false)
        else setError(result.error)
        return
      }
      setConnected(true)
      setError(null)
      setListings((prev) => ({ ...prev, [keyOf(folderId)]: { items: result.items } }))
    },
    []
  )

  const load = useCallback(
    async (folderId: string | null): Promise<void> => {
      applyList(folderId, await window.api.drive.list(folderId))
    },
    [applyList]
  )

  const reloadAll = useCallback(async (): Promise<void> => {
    await load(null)
    for (const id of expandedRef.current) void load(id)
  }, [load])

  useEffect(() => {
    if (!open) return
    let alive = true
    const run = (): void => {
      void window.api.cloud.getStatus().then((status) => {
        if (alive) setEmail(status.connected ? status.email : null)
      })
      void window.api.drive.list(null).then((result) => {
        if (alive) applyList(null, result)
      })
    }
    run()
    window.addEventListener(GOOGLE_STATUS_CHANGED, run)
    return () => {
      alive = false
      window.removeEventListener(GOOGLE_STATUS_CHANGED, run)
    }
  }, [open, applyList])

  const login = async (): Promise<void> => {
    setLoggingIn(true)
    const result = await window.api.cloud.connectGoogle()
    setLoggingIn(false)
    if (!result.ok) {
      pushToast({ kind: 'info', message: result.error })
      return
    }
    notifyGoogleStatusChanged()
  }

  const sortItems = (items: DriveItem[]): DriveItem[] =>
    [...items].sort((a, b) =>
      a.folder !== b.folder
        ? a.folder
          ? -1
          : 1
        : a.name.localeCompare(b.name, 'ko', { numeric: true })
    )

  /** 서버에서 목록을 다시 받지 않고, 방금 한 일을 화면 목록에 바로 반영한다 */
  const patchListing = (parent: string | null, fn: (items: DriveItem[]) => DriveItem[]): void => {
    setListings((prev) => ({
      ...prev,
      [keyOf(parent)]: { items: sortItems(fn(prev[keyOf(parent)]?.items ?? [])) }
    }))
  }

  const toggleFolder = (item: DriveItem): void => {
    setSelectedFolder(item.id)
    const next = new Set(expanded)
    if (next.has(item.id)) {
      next.delete(item.id)
    } else {
      next.add(item.id)
      void load(item.id)
    }
    setExpanded(next)
  }

  const openItem = async (item: DriveItem): Promise<void> => {
    const path = await window.api.drive.localPath(item.id, item.name)
    if (useTabsStore.getState().tabs.some((t) => t.filePath === path)) {
      onOpenFile(path)
      return
    }
    const result = await window.api.drive.download(item.id, item.name)
    if (result.ok) onOpenFile(result.path)
    else report(result)
  }

  const commitCreate = async (name: string): Promise<void> => {
    if (!creating) return
    const { parent, kind } = creating
    setCreating(null)
    if (kind === 'folder') {
      const result = await window.api.drive.createFolder(parent, name)
      if (!result.ok) return report(result)
      patchListing(parent, (items) => [...items, result.item])
      return
    }
    const result = await window.api.drive.createFile(parent, newFileNameFor(name))
    if (!result.ok) return report(result)
    patchListing(parent, (items) => [...items, result.item])
    onOpenFile(result.path)
  }

  const commitRename = async (
    item: DriveItem,
    parent: string | null,
    name: string
  ): Promise<void> => {
    setRenaming(null)
    if (name === item.name) return
    const result = await window.api.drive.rename(item.id, item.folder ? name : newFileNameFor(name))
    if (!result.ok) return report(result)
    const newName = item.folder ? name : newFileNameFor(name)
    patchListing(parent, (items) =>
      items.map((i) => (i.id === item.id ? { ...i, name: newName } : i))
    )
  }

  const confirmDelete = async (parent: string | null): Promise<void> => {
    const item = deleting
    setDeleting(null)
    if (!item) return
    const result = await window.api.drive.trash(item.id)
    if (!result.ok) return report(result)
    patchListing(parent, (items) => items.filter((i) => i.id !== item.id))
  }

  const canDrop = !!draggingLocalPath && connected === true && !movingIn

  const dropHandlers = (folderId: string | null): React.HTMLAttributes<HTMLElement> => ({
    onDragOver: (e) => {
      if (!canDrop) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      if (dropTarget !== keyOf(folderId)) setDropTarget(keyOf(folderId))
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null)
    },
    onDrop: (e) => {
      if (!canDrop) return
      e.preventDefault()
      e.stopPropagation()
      setDropTarget(null)
      const sourcePath = e.dataTransfer.getData('text/plain') || draggingLocalPath
      if (sourcePath) void moveLocalIn(sourcePath, folderId)
    }
  })

  const moveLocalIn = async (sourcePath: string, folderId: string | null): Promise<void> => {
    const sep = sepOf(sourcePath)
    if (dirtyFilePaths.some((p) => p === sourcePath || p.startsWith(sourcePath + sep))) {
      pushToast({
        kind: 'info',
        message: '저장하지 않은 내용이 있어 옮길 수 없습니다.'
      })
      return
    }
    const name = fileNameOf(sourcePath)
    setMovingIn(keyOf(folderId))
    if (folderId) setExpanded((prev) => new Set(prev).add(folderId))
    try {
      const result = await window.api.drive.uploadLocal(sourcePath, folderId)
      if (!result.ok) return report(result)
      patchListing(folderId, (items) => [...items, result.item])
      await onLocalMoved(sourcePath, result.moved)
      pushToast({ kind: 'info', message: `${name}을(를) Drive로 옮겼습니다.` })
    } finally {
      setMovingIn(null)
    }
  }

  const startCreate = (kind: 'file' | 'folder', parent: string | null = selectedFolder): void => {
    if (parent) {
      setExpanded((prev) => new Set(prev).add(parent))
      if (!listings[parent]) void load(parent)
    }
    setCreating({ parent, kind })
  }

  const isActive = (item: DriveItem): boolean =>
    !item.folder &&
    !!activeFilePath &&
    /[\\/]\.drive[\\/]/.test(activeFilePath) &&
    activeFilePath.includes(item.id)

  /** 어느 폴더의 항목인지 알아야 이름 변경과 삭제 뒤에 그 폴더만 다시 불러온다 */
  const parentOf = (id: string): string | null => {
    for (const [key, listing] of Object.entries(listings)) {
      if (listing.items.some((i) => i.id === id)) return key === ROOT ? null : key
    }
    return null
  }

  const menuItems = (item: DriveItem): ContextMenuItem[] => [
    ...(item.folder
      ? [
          {
            label: '새 파일',
            icon: <NewFileIcon width={15} height={15} />,
            onClick: () => startCreate('file', item.id)
          },
          {
            label: '새 폴더',
            icon: <NewFolderIcon width={15} height={15} />,
            onClick: () => startCreate('folder', item.id)
          }
        ]
      : []),
    {
      label: '이름 변경',
      icon: <RenameIcon width={15} height={15} />,
      sepBefore: item.folder,
      onClick: () => setRenaming(item.id)
    },
    {
      label: '삭제',
      icon: <TrashIcon width={15} height={15} />,
      danger: true,
      onClick: () => setDeleting(item)
    }
  ]

  const renderItems = (parent: string | null, depth: number): React.ReactNode => {
    const items = listings[keyOf(parent)]?.items ?? []
    const paddingLeft = 6 + depth * 16
    return (
      <>
        {creating && creating.parent === parent && creating.kind === 'folder' && (
          <div className="flex h-[30px] w-full items-center gap-1.5 pr-2" style={{ paddingLeft }}>
            <span className="w-3.5 shrink-0" />
            <FileTypeIcon name="" kind="folder" />
            <InlineNameInput
              initialValue=""
              onCommit={(v) => void commitCreate(v)}
              onCancel={() => setCreating(null)}
              paddingLeft={0}
              inline
            />
          </div>
        )}
        {creating && creating.parent === parent && creating.kind === 'file' && (
          <NewFileRow
            paddingLeft={paddingLeft + 20}
            onCommit={(v) => void commitCreate(v)}
            onCancel={() => setCreating(null)}
          />
        )}
        {items.map((item) =>
          renaming === item.id ? (
            <div
              key={item.id}
              className="flex h-[30px] w-full items-center gap-1.5 pr-2"
              style={{ paddingLeft }}
            >
              {item.folder ? (
                <Chevron open={expanded.has(item.id)} />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <FileTypeIcon name={item.name} kind={item.folder ? 'folder' : 'file'} />
              <InlineNameInput
                initialValue={item.name}
                onCommit={(v) => void commitRename(item, parent, v)}
                onCancel={() => setRenaming(null)}
                paddingLeft={0}
                inline
              />
            </div>
          ) : (
            <div key={item.id}>
              <div className="group/row relative">
                <button
                  type="button"
                  {...dropHandlers(item.folder ? item.id : parent)}
                  onClick={() => (item.folder ? toggleFolder(item) : void openItem(item))}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenu({ x: e.clientX, y: e.clientY, item })
                  }}
                  aria-current={isActive(item) ? 'page' : undefined}
                  className={`${ROW_BASE} ${isActive(item) ? '!bg-bg-mute font-medium' : ''} ${
                    item.folder && dropTarget === item.id
                      ? 'bg-accent-soft ring-1 ring-inset ring-accent'
                      : ''
                  }`}
                  style={{ paddingLeft }}
                >
                  {item.folder ? (
                    <Chevron open={expanded.has(item.id)} />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <FileTypeIcon name={item.name} kind={item.folder ? 'folder' : 'file'} />
                  <span className="truncate">{item.name}</span>
                </button>
                <span className="absolute right-1 top-1/2 flex -translate-y-1/2">
                  <button
                    type="button"
                    aria-label={`${item.name} 메뉴`}
                    title="메뉴"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      setMenu({ x: r.left, y: r.bottom + 4, item })
                    }}
                    className={ROW_ACTION}
                  >
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <circle cx="3.5" cy="8" r="1.3" />
                      <circle cx="8" cy="8" r="1.3" />
                      <circle cx="12.5" cy="8" r="1.3" />
                    </svg>
                  </button>
                </span>
              </div>
              {item.folder && movingIn === item.id && (
                <div
                  className="flex h-[30px] items-center text-[12.5px] text-text-tertiary"
                  style={{ paddingLeft: paddingLeft + 20 }}
                >
                  Drive로 옮기는 중…
                </div>
              )}
              <Collapse open={item.folder && expanded.has(item.id)}>
                {!listings[item.id] && (
                  <div
                    className="flex h-[30px] items-center text-[12.5px] text-text-tertiary"
                    style={{ paddingLeft: paddingLeft + 20 }}
                  >
                    불러오는 중…
                  </div>
                )}
                {renderItems(item.id, depth + 1)}
              </Collapse>
            </div>
          )
        )}
      </>
    )
  }

  const rootItems = listings[ROOT]?.items
  return (
    <div
      className="group/drive flex min-h-0 flex-col overflow-hidden border-t border-border transition-[flex-grow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ flexGrow: open ? 1 : 0, flexShrink: 1, flexBasis: SECTION_HEADER_BASIS }}
    >
      <div className="flex h-9 shrink-0 items-center justify-between pl-2 pr-2">
        <SectionHeader label="Google Drive" open={open} onToggle={onToggle} />
        <div className={`flex items-center gap-0.5 ${connected ? '' : 'invisible'}`}>
          <button
            type="button"
            onClick={() => void reloadAll()}
            title="새로고침"
            disabled={!connected}
            className={`${ICON_BTN} opacity-0 transition-opacity duration-150 group-focus-within/drive:opacity-100 group-hover/drive:opacity-100`}
          >
            <span className="text-[14px] leading-none">↻</span>
          </button>
        </div>
      </div>
      <div
        className={`min-h-0 flex-1 overflow-auto px-2 pb-2 ${dropTarget === ROOT ? 'bg-accent-soft/40' : ''}`}
        inert={!open}
        {...dropHandlers(null)}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedFolder(null)
          }
        }}
        onContextMenu={(e) => {
          if (e.defaultPrevented || !connected) return
          e.preventDefault()
          setRootMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {connected && email && (
          <div title={email} className="truncate px-2 pb-1 text-[11.5px] text-text-tertiary">
            {email}
          </div>
        )}
        {connected === false ? (
          <div className="px-2 py-1 text-[12.5px] text-text-tertiary">
            Google Drive 연결을 위해 로그인이 필요합니다.
            <button
              type="button"
              disabled={loggingIn}
              onClick={() => void login()}
              className="mt-2.5 flex h-8 w-full items-center justify-center rounded-lg bg-accent-soft text-[13px] font-medium text-accent outline-none hover:brightness-110 disabled:opacity-60"
            >
              {loggingIn ? '로그인하는 중…' : '로그인'}
            </button>
          </div>
        ) : error ? (
          <div className="px-2 py-1 text-[12.5px] text-text-tertiary">
            {error}
            <button
              type="button"
              onClick={() => void load(null)}
              className="mt-2 block h-7 rounded-lg bg-bg-mute px-3 text-[12.5px] text-text-secondary outline-none hover:text-text"
            >
              다시 시도
            </button>
          </div>
        ) : !rootItems ? (
          <div className="px-2 py-1 text-[12.5px] text-text-tertiary">불러오는 중…</div>
        ) : rootItems.length === 0 && !creating ? (
          <div className="px-2 py-1 text-[12.5px] text-text-tertiary">파일 없음</div>
        ) : (
          renderItems(null, 0)
        )}
        {movingIn === ROOT && (
          <div className="px-2 py-1 text-[12.5px] text-text-tertiary">Drive로 옮기는 중…</div>
        )}
      </div>
      {rootMenu && (
        <ContextMenu
          x={rootMenu.x}
          y={rootMenu.y}
          items={[
            {
              label: '새 파일',
              icon: <NewFileIcon width={15} height={15} />,
              onClick: () => startCreate('file', null)
            },
            {
              label: '새 폴더',
              icon: <NewFolderIcon width={15} height={15} />,
              onClick: () => startCreate('folder', null)
            }
          ]}
          onClose={() => setRootMenu(null)}
        />
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.item)}
          onClose={() => setMenu(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Drive에서 삭제하시겠습니까?"
          subject={{ name: deleting.name, kind: deleting.folder ? 'folder' : 'file' }}
          message="Drive 휴지통으로 이동됩니다. Drive 웹에서 복원할 수 있습니다."
          confirmLabel="삭제"
          danger
          onConfirm={() => void confirmDelete(parentOf(deleting.id))}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
