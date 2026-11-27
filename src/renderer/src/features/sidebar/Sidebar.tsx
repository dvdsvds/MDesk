import { forwardRef, useImperativeHandle, useState } from 'react'
import type { TreeNode } from '../../types/workspace'
import { ContextMenu } from '../../components/ContextMenu'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ExportDialog } from '../export/ExportDialog'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { AppLogoMark } from '../../components/AppIcon'
import { dirOf, fileNameOf, sepOf } from '@renderer/utils/path'
import SearchIcon from '../../icons/search.svg?react'
import NewFolderIcon from '../../icons/new-folder.svg?react'
import NewFileIcon from '../../icons/new-file.svg?react'
import TrashIcon from '../../icons/ctx-trash.svg?react'
import SettingsIcon from '../../icons/settings.svg?react'
import { SectionHeader } from './SectionHeader'
import { InlineNameInput, NewFileRow } from './InlineInputs'
import { TreeRow, findNodeByPath, type RowContext } from './TreeRow'
import { buildMenuItems } from './sidebarMenu'
import { useTreeFocus } from './useTreeFocus'
import { useTreeActions, type DeleteTarget } from './useTreeActions'
import { TagSection } from './TagSection'
import { TemplateSection } from './TemplateSection'
import { DriveSection } from './DriveSection'
import type { NoteTemplate } from '../../utils/noteTemplate'
import { useSettingsStore } from '@renderer/stores/settingsStore'

interface SidebarProps {
  tree: TreeNode[]
  rootDir: string | null
  activeFilePath: string | null
  onOpenFile: (filePath: string) => void
  onEntryRenamed: (oldPath: string, newPath: string) => void
  onEntryMoved: (oldPath: string, newPath: string) => void
  onEntryDeleted: (path: string) => void
  onFileCreated: (filePath: string) => void
  onFocusEditor: () => void
  dirtyFilePaths: string[]
  onCompareChanges: (filePath: string) => void
  onOpenHistory: (filePath: string) => void
  onOpenAtLine: (filePath: string, line: number) => void
  onOpenSettings: () => void
  selectedFolderPath: string | null
  onSelectFolder: (path: string | null) => void
  /** 열려 있는 데일리 노트의 날짜. 날짜 섹션을 그날로 맞춘다 */
  onInsertTemplate: (template: NoteTemplate) => void
  onCreateFromTemplate: (template: NoteTemplate) => void
  /** 검색 창을 연다 */
  onOpenSearch: () => void
  className?: string
  style?: React.CSSProperties
}

/** 단축키로 선택된 항목에 실행하는 사이드바 동작 */
export type SidebarCommand = 'rename' | 'newFolder' | 'reveal' | 'export'

export interface SidebarHandle {
  startNewFile: (dirPath: string) => void
  runCommand: (command: SidebarCommand) => void
}

/** 접힌 섹션의 높이: 머리 줄 36px + 위 테두리 1px */
const SECTION_HEADER_BASIS = '37px'

const FOOTER_BTN =
  'flex h-7 w-7 items-center justify-center rounded-md text-text-secondary outline-none transition-colors hover:bg-bg-mute hover:text-text'

const ICON_BTN =
  'flex h-[26px] w-[26px] items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-mute hover:text-text disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary'

function countDirtyUnder(dirtyFilePaths: string[], node: TreeNode): number {
  const prefix = node.path + sepOf(node.path)
  return dirtyFilePaths.filter((p) => p === node.path || p.startsWith(prefix)).length
}

/** 삭제 확인 창의 안내. 저장 안 한 변경이 있을 때만 알린다 */
function deleteMessage(target: DeleteTarget, dirtyCount: number): string | undefined {
  if (dirtyCount === 0) return undefined
  return target.node.type === 'folder'
    ? '저장하지 않은 변경 사항이 있는 파일이 있습니다. 삭제하면 이 변경 사항은 되돌릴 수 없습니다.'
    : '저장하지 않은 변경 사항이 있습니다. 삭제하면 이 변경 사항은 되돌릴 수 없습니다.'
}

export const Sidebar = forwardRef<SidebarHandle, SidebarProps>(function Sidebar(
  {
    tree,
    rootDir,
    activeFilePath,
    onOpenFile,
    onEntryRenamed,
    onEntryMoved,
    onEntryDeleted,
    onFileCreated,
    onFocusEditor,
    dirtyFilePaths,
    onCompareChanges,
    onOpenHistory,
    onOpenAtLine,
    onOpenSettings,
    selectedFolderPath,
    onSelectFolder,
    onInsertTemplate,
    onCreateFromTemplate,
    onOpenSearch,
    className,
    style
  }: SidebarProps,
  ref
) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(
    null
  )
  const [exportTarget, setExportTarget] = useState<{
    folderPath: string
    isRoot: boolean
    label: string
  } | null>(null)
  const filesOpen = useSettingsStore((s) => s.filesSectionOpen)
  const setFilesOpen = useSettingsStore((s) => s.setFilesSectionOpen)
  const shortcuts = useSettingsStore((s) => s.shortcuts)
  const tagsOpen = useSettingsStore((s) => s.tagsSectionOpen)
  const setTagsOpen = useSettingsStore((s) => s.setTagsSectionOpen)
  const driveOpen = useSettingsStore((s) => s.driveSectionOpen)
  const setDriveOpen = useSettingsStore((s) => s.setDriveSectionOpen)
  const templatesOpen = useSettingsStore((s) => s.templatesSectionOpen)
  const setTemplatesOpen = useSettingsStore((s) => s.setTemplatesSectionOpen)

  const {
    rowRefs,
    isExpanded,
    toggleExpand,
    expandPath,
    registerRowRef,
    showRing,
    setShowRing,
    highlightOff,
    setHighlightOff,
    focusedPath,
    setFocusedPath,
    handleRowOpenFile,
    handleRowSelectFolder,
    visibleNodes,
    handleTreeKeyDown
  } = useTreeFocus({
    tree,
    rootDir,
    activeFilePath,
    selectedFolderPath,
    onOpenFile,
    onSelectFolder,
    onFocusEditor
  })

  const {
    editingPath,
    setEditingPath,
    newFolderIn,
    setNewFolderIn,
    newFileIn,
    setNewFileIn,
    draggingPath,
    setDraggingPath,
    deleteTarget,
    setDeleteTarget,
    commitRename,
    commitNewFolder,
    commitNewFile,
    openDeleteConfirm,
    confirmDelete,
    handleDrop,
    finishMoveToDrive,
    undoLast
  } = useTreeActions({
    visibleNodes,
    rowRefs,
    setFocusedPath,
    onEntryRenamed,
    onEntryMoved,
    onEntryDeleted,
    onFileCreated
  })

  // 단축키 동작의 대상: 삭제(Delete)와 같은 규칙으로 고른다(포커스한 줄, 선택한 폴더, 열려 있는 파일 순)
  const runCommand = (command: SidebarCommand): void => {
    const path = focusedPath ?? selectedFolderPath ?? activeFilePath
    const node = path ? findNodeByPath(tree, path) : null
    if (command === 'newFolder') {
      const dir = node ? (node.type === 'folder' ? node.path : dirOf(node.path)) : rootDir
      if (!dir) return
      expandPath(dir)
      setNewFolderIn(dir)
      return
    }
    if (!node) return
    switch (command) {
      case 'rename':
        if (node.type === 'file') expandPath(dirOf(node.path))
        setEditingPath(node.path)
        break
      case 'reveal':
        void window.api.workspace.reveal(node.path)
        break
      case 'export': {
        // 폴더가 아니면 그 파일이 들어 있는 폴더를 내보낸다
        const dir = node.type === 'folder' ? node.path : dirOf(node.path)
        setExportTarget({
          folderPath: dir,
          isRoot: rootDir !== null && dir === rootDir,
          label: node.type === 'folder' ? node.name : fileNameOf(dir)
        })
        break
      }
    }
  }

  useImperativeHandle(ref, () => ({
    startNewFile: (dirPath: string) => setNewFileIn(dirPath),
    runCommand
  }))

  const resolveToolbarDir = (): string | null => {
    if (selectedFolderPath) return selectedFolderPath
    if (activeFilePath) return dirOf(activeFilePath)
    return rootDir
  }

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode): void => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  const ctx: RowContext = {
    activeFilePath,
    selectedFolderPath,
    highlightOff,
    showRing,
    dirtyFilePaths,
    editingPath,
    newFolderIn,
    newFileIn,
    draggingPath,
    isExpanded,
    onToggleExpand: toggleExpand,
    registerRowRef,
    focusedPath,
    onOpenFile: handleRowOpenFile,
    onSelectFolder: handleRowSelectFolder,
    onStartRename: (node) => setEditingPath(node.path),
    onCommitRename: commitRename,
    onCancelRename: () => setEditingPath(null),
    onCommitNewFolder: commitNewFolder,
    onCancelNewFolder: () => setNewFolderIn(null),
    onCommitNewFile: commitNewFile,
    onCancelNewFile: () => setNewFileIn(null),
    onContextMenu: handleContextMenu,
    onMenuAt: (node, x, y) => setContextMenu({ x, y, node }),
    onNewFileIn: (dirPath) => {
      expandPath(dirPath)
      setNewFileIn(dirPath)
    },
    onDragStart: (e, node) => {
      e.dataTransfer.setData('text/plain', node.path)
      e.dataTransfer.effectAllowed = 'move'
      setDraggingPath(node.path)
    },
    onDragEnd: () => setDraggingPath(null),
    onDrop: handleDrop
  }

  const menuItems = contextMenu
    ? buildMenuItems(contextMenu.node, {
        rootDir,
        dirtyFilePaths,
        expandPath,
        startNewFile: setNewFileIn,
        startNewFolder: setNewFolderIn,
        startRename: setEditingPath,
        openExport: setExportTarget,
        openDelete: openDeleteConfirm,
        onCompareChanges,
        onOpenHistory,
        shortcuts
      })
    : []

  return (
    <div
      tabIndex={-1}
      className={`group/sb thin-scroll flex flex-col outline-none ${className ?? ''}`}
      style={style}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => rootDir && handleDrop(e, rootDir)}
      onKeyDown={(e) => handleTreeKeyDown(e, openDeleteConfirm, () => void undoLast())}
    >
      <div className="titlebar-drag flex h-11 shrink-0 items-center gap-1.5 pl-3.5 pr-2">
        <AppLogoMark size={20} />
      </div>
      {/* 검색: 아래 영역 제목과 헷갈리지 않게 입력칸 모양으로 둔다 */}
      <div className="shrink-0 px-2.5 pb-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-bg-mute/50 px-2.5 text-left text-[13px] text-text-tertiary outline-none transition-colors hover:border-border-strong hover:text-text-secondary"
        >
          <SearchIcon width={15} height={15} className="shrink-0" />
          검색
          <kbd className="ml-auto font-sans text-[11px] text-text-tertiary">{shortcuts.search}</kbd>
        </button>
      </div>
      <div className={`flex min-h-0 flex-col ${filesOpen ? 'flex-1' : 'shrink-0'}`}>
        <div className="flex h-9 shrink-0 items-center justify-between pl-2 pr-2">
          <SectionHeader label="로컬" open={filesOpen} onToggle={() => setFilesOpen(!filesOpen)} />
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                const dir = resolveToolbarDir()
                if (dir) {
                  expandPath(dir)
                  setNewFolderIn(dir)
                }
              }}
              title="새 폴더"
              aria-label="새 폴더"
              disabled={!rootDir}
              className={`${ICON_BTN} !w-[30px]`}
            >
              <NewFolderIcon />
            </button>
            <button
              type="button"
              onClick={() => {
                const dir = resolveToolbarDir()
                if (dir) {
                  expandPath(dir)
                  setNewFileIn(dir)
                }
              }}
              title={`새 파일 (${shortcuts.newNote})`}
              aria-label="새 파일"
              disabled={!rootDir}
              className={ICON_BTN}
            >
              <NewFileIcon />
            </button>
          </div>
        </div>
        {filesOpen && (
          <div
            className="flex-1 overflow-auto px-2 pb-2"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setFocusedPath(null)
                setHighlightOff(true)
                setShowRing(false)
                if (rootDir) onSelectFolder(rootDir)
                e.currentTarget.parentElement?.parentElement?.focus()
              }
            }}
          >
            {newFolderIn === rootDir && rootDir && (
              <div
                className="flex h-[30px] w-full items-center gap-1.5 pr-2"
                style={{ paddingLeft: 6 }}
              >
                <span className="w-3.5 shrink-0" />
                <FileTypeIcon name="" kind="folder" />
                <InlineNameInput
                  initialValue=""
                  onCommit={(value) => commitNewFolder(rootDir, value)}
                  onCancel={() => setNewFolderIn(null)}
                  paddingLeft={0}
                  inline
                />
              </div>
            )}
            {newFileIn === rootDir && rootDir && (
              <NewFileRow
                paddingLeft={26}
                onCommit={(value) => commitNewFile(rootDir, value)}
                onCancel={() => setNewFileIn(null)}
              />
            )}
            {tree.map((node) => (
              <TreeRow key={node.path} node={node} depth={0} ctx={ctx} />
            ))}
          </div>
        )}
      </div>
      <DriveSection
        open={driveOpen}
        onToggle={() => setDriveOpen(!driveOpen)}
        onOpenFile={onOpenFile}
        onOpenSettings={onOpenSettings}
        draggingLocalPath={draggingPath}
        dirtyFilePaths={dirtyFilePaths}
        onLocalMoved={finishMoveToDrive}
        activeFilePath={activeFilePath}
      />
      <div
        className="flex min-h-0 flex-col overflow-hidden border-t border-border transition-[flex-grow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ flexGrow: tagsOpen ? 1 : 0, flexShrink: 1, flexBasis: SECTION_HEADER_BASIS }}
      >
        <div className="flex h-9 shrink-0 items-center pl-2 pr-2">
          <SectionHeader label="태그" open={tagsOpen} onToggle={() => setTagsOpen(!tagsOpen)} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto pb-2" inert={!tagsOpen}>
          <TagSection tree={tree} activeFilePath={activeFilePath} onOpenFile={onOpenFile} />
        </div>
      </div>
      <div
        className="flex min-h-0 flex-col overflow-hidden border-t border-border transition-[flex-grow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ flexGrow: templatesOpen ? 1 : 0, flexShrink: 1, flexBasis: SECTION_HEADER_BASIS }}
      >
        <div className="flex h-9 shrink-0 items-center pl-2 pr-2">
          <SectionHeader
            label="템플릿"
            open={templatesOpen}
            onToggle={() => setTemplatesOpen(!templatesOpen)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto pb-2" inert={!templatesOpen}>
          <TemplateSection onInsert={onInsertTemplate} onCreateNote={onCreateFromTemplate} />
        </div>
      </div>
      {/* 맨 아래 줄: 휴지통 폴더 열기와 설정을 오른쪽 끝에 둔다. 영역을 모두 접어도 맨 아래에 붙어 있게 mt-auto */}
      <div className="mt-auto flex h-10 shrink-0 items-center justify-end gap-0.5 border-t border-border px-2">
        <button
          type="button"
          onClick={() => void window.api.workspace.openTrash()}
          title="휴지통 폴더 열기"
          className={FOOTER_BTN}
        >
          <TrashIcon width={16} height={16} />
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          title={`설정 (${shortcuts.toggleSettings})`}
          className={FOOTER_BTN}
        >
          <SettingsIcon width={17} height={17} />
        </button>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="삭제하시겠습니까?"
          subject={{ name: deleteTarget.node.name, kind: deleteTarget.node.type }}
          message={deleteMessage(deleteTarget, countDirtyUnder(dirtyFilePaths, deleteTarget.node))}
          references={deleteTarget.backlinks ?? undefined}
          confirmLabel="삭제"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {exportTarget && (
        <ExportDialog
          folderPath={exportTarget.folderPath}
          isRoot={exportTarget.isRoot}
          folderLabel={exportTarget.label}
          onOpenLink={(path, line) => onOpenAtLine(path, line ?? 1)}
          onClose={() => setExportTarget(null)}
        />
      )}
    </div>
  )
})
