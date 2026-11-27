import { AnimatePresence, motion } from 'motion/react'
import type { TreeNode } from '../../types/workspace'
import { FileExt, FileTypeIcon } from '../../components/FileTypeIcon'
import { splitName } from '@renderer/utils/path'
import { InlineNameInput, NewFileRow } from './InlineInputs'

export interface RowContext {
  activeFilePath: string | null
  selectedFolderPath: string | null
  highlightOff: boolean
  showRing: boolean
  dirtyFilePaths: string[]
  editingPath: string | null
  newFolderIn: string | null
  newFileIn: string | null
  draggingPath: string | null
  isExpanded: (path: string) => boolean
  onToggleExpand: (path: string) => void
  registerRowRef: (path: string, el: HTMLButtonElement | null) => void
  focusedPath: string | null
  onOpenFile: (filePath: string) => void
  onSelectFolder: (path: string) => void
  onStartRename: (node: TreeNode) => void
  onCommitRename: (node: TreeNode, newName: string) => void
  onCancelRename: () => void
  onCommitNewFolder: (dirPath: string, name: string) => void
  onCancelNewFolder: () => void
  onCommitNewFile: (dirPath: string, name: string) => void
  onCancelNewFile: () => void
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
  /** … 버튼으로 그 자리에 메뉴를 띄운다 */
  onMenuAt: (node: TreeNode, x: number, y: number) => void
  /** 폴더를 펼치고 그 안에 새 파일 입력 줄을 띄운다 */
  onNewFileIn: (dirPath: string) => void
  onDragStart: (e: React.DragEvent, node: TreeNode) => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent, targetDirPath: string) => void
}

const ROW_BASE =
  'flex h-[30px] w-full items-center gap-1.5 rounded-md pr-2 text-left text-[13px] text-text transition-colors group-hover/row:bg-bg-mute/60 focus:outline-none'

/** 마우스를 올린 줄에만 보이는 오른쪽 버튼 */
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

/** 마우스를 올리면 나타나는 … (메뉴)와 + (이 폴더에 새 파일) */
function RowActions({ node, ctx }: { node: TreeNode; ctx: RowContext }): React.JSX.Element {
  return (
    <span className="pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100">
      <button
        type="button"
        aria-label={`${node.name} 메뉴`}
        title="메뉴"
        onClick={(e) => {
          e.stopPropagation()
          const r = e.currentTarget.getBoundingClientRect()
          ctx.onMenuAt(node, r.left, r.bottom + 4)
        }}
        className={ROW_ACTION}
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>
      {node.type === 'folder' && (
        <button
          type="button"
          aria-label={`${node.name} 안에 새 파일`}
          title="새 파일"
          onClick={(e) => {
            e.stopPropagation()
            ctx.onNewFileIn(node.path)
          }}
          className={ROW_ACTION}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
        </button>
      )}
    </span>
  )
}

const SYSTEM_FOLDERS = new Set(['img', 'files'])

export function findNodeByPath(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNodeByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}

function nameWithoutExt(node: TreeNode): string {
  return node.type === 'file' ? splitName(node.name).base : node.name
}

export function TreeRow({
  node,
  depth,
  ctx
}: {
  node: TreeNode
  depth: number
  ctx: RowContext
}): React.JSX.Element {
  const expanded = ctx.isExpanded(node.path)
  const paddingLeft = 6 + depth * 16
  const childPadding = 6 + (depth + 1) * 16

  if (node.type === 'folder') {
    const isSystem = SYSTEM_FOLDERS.has(node.name)
    return (
      <div>
        <div
          draggable
          onDragStart={(e) => ctx.onDragStart(e, node)}
          onDragEnd={ctx.onDragEnd}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => ctx.onDrop(e, node.path)}
          onContextMenu={(e) => ctx.onContextMenu(e, node)}
          className={`group/row relative flex items-center ${ctx.draggingPath === node.path ? 'opacity-40' : ''}`}
        >
          {ctx.editingPath === node.path ? (
            <div className="flex h-[30px] w-full items-center gap-1.5 pr-2" style={{ paddingLeft }}>
              <Chevron open={expanded} />
              <FileTypeIcon name={node.name} kind="folder" />
              <InlineNameInput
                initialValue={node.name}
                onCommit={(value) => ctx.onCommitRename(node, value)}
                onCancel={ctx.onCancelRename}
                paddingLeft={paddingLeft}
                inline
                medium={!isSystem}
              />
            </div>
          ) : (
            <button
              ref={(el) => ctx.registerRowRef(node.path, el)}
              type="button"
              onClick={() => {
                ctx.onToggleExpand(node.path)
                ctx.onSelectFolder(node.path)
              }}
              className={`${ROW_BASE} ${
                ctx.showRing && ctx.focusedPath === node.path
                  ? 'ring-1 ring-inset ring-accent/60'
                  : ''
              } text-text`}
              style={{ paddingLeft }}
            >
              <Chevron open={expanded} />
              <FileTypeIcon name={node.name} kind="folder" />
              <span className={`truncate ${isSystem ? 'text-text-secondary' : ''}`}>
                {node.name}
              </span>
            </button>
          )}
          {ctx.editingPath !== node.path && <RowActions node={node} ctx={ctx} />}
        </div>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden' }}
            >
              {ctx.newFolderIn === node.path && (
                <div
                  className="flex h-[30px] w-full items-center gap-1.5 pr-2"
                  style={{ paddingLeft: childPadding }}
                >
                  <span className="w-3.5 shrink-0" />
                  <FileTypeIcon name="" kind="folder" />
                  <InlineNameInput
                    initialValue=""
                    onCommit={(value) => ctx.onCommitNewFolder(node.path, value)}
                    onCancel={ctx.onCancelNewFolder}
                    paddingLeft={0}
                    inline
                    medium
                  />
                </div>
              )}
              {ctx.newFileIn === node.path && (
                <NewFileRow
                  paddingLeft={childPadding + 20}
                  onCommit={(value) => ctx.onCommitNewFile(node.path, value)}
                  onCancel={ctx.onCancelNewFile}
                />
              )}
              {node.children?.map((child) => (
                <TreeRow key={child.path} node={child} depth={depth + 1} ctx={ctx} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (ctx.editingPath === node.path) {
    return (
      <div className="flex h-[30px] w-full items-center gap-1.5 pr-2" style={{ paddingLeft }}>
        <span className="w-3.5 shrink-0" />
        <FileTypeIcon name={node.name} kind="file" />
        <InlineNameInput
          initialValue={nameWithoutExt(node)}
          onCommit={(value) => ctx.onCommitRename(node, value)}
          onCancel={ctx.onCancelRename}
          paddingLeft={0}
          inline
        />
      </div>
    )
  }

  const isActive = node.path === ctx.activeFilePath && !ctx.highlightOff
  const isDirty = ctx.dirtyFilePaths.includes(node.path)
  const { base, ext } = splitName(node.name)
  return (
    <div className="group/row relative">
      <button
        ref={(el) => ctx.registerRowRef(node.path, el)}
        type="button"
        draggable
        onDragStart={(e) => ctx.onDragStart(e, node)}
        onDragEnd={ctx.onDragEnd}
        onContextMenu={(e) => ctx.onContextMenu(e, node)}
        onClick={() => ctx.onOpenFile(node.path)}
        aria-current={isActive ? 'page' : undefined}
        className={`${ROW_BASE} ${
          ctx.showRing && ctx.focusedPath === node.path ? 'ring-1 ring-inset ring-accent/60' : ''
        } ${isActive ? '!bg-bg-mute font-medium' : ''} ${ctx.draggingPath === node.path ? 'opacity-40' : ''}`}
        style={{ paddingLeft }}
      >
        <span className="w-3.5 shrink-0" />
        <FileTypeIcon name={node.name} kind="file" />
        <span className="truncate">
          {base}
          {/* 마크다운 파일은 확장자 없이 제목만 보인다 */}
          {ext && ext.toLowerCase() !== '.md' && <FileExt name={node.name} ext={ext} />}
        </span>
        {isDirty && (
          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent group-hover/row:opacity-0" />
        )}
      </button>
      {!ctx.draggingPath && <RowActions node={node} ctx={ctx} />}
    </div>
  )
}
