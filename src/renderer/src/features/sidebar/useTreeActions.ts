import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { TreeNode } from '../../types/workspace'
import { dirOf, fileNameOf, sepOf, splitName } from '@renderer/utils/path'
import { popUndo, pushUndo } from '@renderer/utils/sidebarUndo'
import { useToastStore } from '@renderer/stores/toastStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'

export interface DeleteTarget {
  node: TreeNode
  backlinks: { path: string; count: number }[] | null
  loading: boolean
}

export function useTreeActions({
  visibleNodes,
  rowRefs,
  setFocusedPath,
  onEntryRenamed,
  onEntryMoved,
  onEntryDeleted,
  onFileCreated
}: {
  visibleNodes: TreeNode[]
  rowRefs: React.RefObject<Map<string, HTMLButtonElement>>
  setFocusedPath: (path: string | null) => void
  onEntryRenamed: (oldPath: string, newPath: string) => void
  onEntryMoved: (oldPath: string, newPath: string) => void
  onEntryDeleted: (path: string) => void
  onFileCreated: (filePath: string) => void
}) {
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [newFolderIn, setNewFolderIn] = useState<string | null>(null)
  const [newFileIn, setNewFileIn] = useState<string | null>(null)
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  // 파일 감시기가 트리를 알려 주기까지 약 0.15초가 걸린다. 그 사이 입력 줄이 먼저 사라지면
  // 목록에서 줄이 잠깐 없어졌다 나타나 새로고침처럼 보이므로, 만든 직후 트리를 바로 받아 반영한 뒤에 입력 줄을 닫는다
  const creatingRef = useRef(false)
  // 새 트리와 입력 줄 닫기를 한 번에 반영해서, 새 줄과 입력 줄이 잠깐 같이 보이는 것도 막는다
  const applyTreeAndClose = async (close: () => void): Promise<void> => {
    const tree = await window.api.workspace.getTree()
    flushSync(() => {
      useWorkspaceStore.getState().setTree(tree)
      close()
    })
  }

  // 트리만 바로 다시 받아 반영한다(삭제·이동·되돌리기처럼 닫을 입력 줄이 없는 경우)
  const syncTree = (): Promise<void> => applyTreeAndClose(() => {})

  const renamingRef = useRef(false)
  const commitRename = (node: TreeNode, rawValue: string): void => {
    const newName = node.type === 'file' ? `${rawValue}${splitName(node.name).ext}` : rawValue
    if (newName === node.name) {
      setEditingPath(null)
      return
    }
    if (renamingRef.current) return
    renamingRef.current = true
    window.api.workspace
      .renameEntry(node.path, newName)
      .then(async (newPath) => {
        pushUndo({ kind: 'rename', oldPath: node.path, newPath })
        onEntryRenamed(node.path, newPath)
        // 새 이름의 트리가 반영되기 전에 입력 줄을 닫으면 옛 이름이 잠깐 보인다
        await applyTreeAndClose(() => setEditingPath(null))
      })
      .catch(() => {
        setEditingPath(null)
        useToastStore
          .getState()
          .push({ kind: 'info', message: `'${newName}' 이름이 이미 있거나 바꿀 수 없어요.` })
      })
      .finally(() => {
        renamingRef.current = false
      })
  }

  const commitNewFolder = (dirPath: string, name: string): void => {
    if (creatingRef.current) return
    creatingRef.current = true
    const separator = sepOf(dirPath)
    void window.api.workspace
      .createFolder(dirPath, name)
      .then(async () => {
        await applyTreeAndClose(() => setNewFolderIn(null))
        setFocusedPath(`${dirPath}${separator}${name}`)
      })
      .catch(() => setNewFolderIn(null))
      .finally(() => {
        creatingRef.current = false
      })
  }

  const commitNewFile = (dirPath: string, rawTitle: string): void => {
    if (creatingRef.current) return
    creatingRef.current = true
    void window.api.workspace
      .createNote(dirPath, rawTitle)
      .then(async (filePath) => {
        await applyTreeAndClose(() => setNewFileIn(null))
        onFileCreated(filePath)
        setFocusedPath(filePath)
      })
      .catch(() => setNewFileIn(null))
      .finally(() => {
        creatingRef.current = false
      })
  }

  const openDeleteConfirm = (node: TreeNode): void => {
    const isMd = node.type === 'file' && node.name.toLowerCase().endsWith('.md')
    setDeleteTarget({ node, backlinks: null, loading: isMd })
    if (isMd) {
      void window.api.workspace.findBacklinks(node.path).then((backlinks) => {
        setDeleteTarget({ node, backlinks, loading: false })
      })
    }
  }

  const confirmDelete = (): void => {
    if (!deleteTarget) return
    const { node } = deleteTarget
    const sep = sepOf(node.path)
    const idx = visibleNodes.findIndex((n) => n.path === node.path)
    const after = visibleNodes.slice(idx + 1).find((n) => !n.path.startsWith(node.path + sep))
    const neighbor = after ?? visibleNodes[idx - 1] ?? null
    void window.api.workspace.trash(node.path).then(async (trashId) => {
      pushUndo({ kind: 'delete', trashId })
      onEntryDeleted(node.path)
      await syncTree()
      const next = neighbor ? neighbor.path : null
      setFocusedPath(next)
      setTimeout(() => {
        if (next) rowRefs.current.get(next)?.focus()
      }, 50)
    })
    setDeleteTarget(null)
  }

  const handleDrop = (e: React.DragEvent, targetDirPath: string): void => {
    e.preventDefault()
    e.stopPropagation()
    const sourcePath = e.dataTransfer.getData('text/plain')
    setDraggingPath(null)
    if (!sourcePath) return
    if (dirOf(sourcePath) === targetDirPath) return
    void window.api.workspace.moveEntry(sourcePath, targetDirPath).then(async (newPath) => {
      pushUndo({ kind: 'move', oldPath: sourcePath, newPath })
      onEntryMoved(sourcePath, newPath)
      await syncTree()
    })
  }

  const undoLast = async (): Promise<void> => {
    const op = popUndo()
    if (!op) return
    const toast = useToastStore.getState().push
    try {
      if (op.kind === 'delete') {
        const restored = await window.api.workspace.restoreTrash(op.trashId)
        await syncTree()
        setFocusedPath(restored)
        toast({ kind: 'info', message: `${fileNameOf(restored)}을(를) 되돌렸어요.` })
      } else if (op.kind === 'rename') {
        const back = await window.api.workspace.renameEntry(op.newPath, fileNameOf(op.oldPath))
        onEntryRenamed(op.newPath, back)
        await syncTree()
        setFocusedPath(back)
      } else {
        const back = await window.api.workspace.moveEntry(op.newPath, dirOf(op.oldPath))
        onEntryMoved(op.newPath, back)
        if (fileNameOf(back) === fileNameOf(op.oldPath)) {
          await syncTree()
          setFocusedPath(back)
        } else {
          const renamed = await window.api.workspace.renameEntry(back, fileNameOf(op.oldPath))
          onEntryRenamed(back, renamed)
          await syncTree()
          setFocusedPath(renamed)
        }
      }
    } catch {
      toast({
        kind: 'info',
        message: '되돌릴 수 없어요. 같은 이름이 이미 있거나 파일이 바뀌었어요.'
      })
    }
  }

  return {
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
    undoLast
  }
}
