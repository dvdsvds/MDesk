import { create } from 'zustand'
import type { TreeNode } from '../types/workspace'

interface WorkspaceState {
  rootDir: string | null
  tree: TreeNode[]
  setTree: (tree: TreeNode[]) => void
  setRootDir: (rootDir: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  rootDir: null,
  tree: [],
  // 감시기가 뒤늦게 같은 트리를 보내면 다시 그리지 않는다
  setTree: (tree) => set((s) => (JSON.stringify(s.tree) === JSON.stringify(tree) ? s : { tree })),
  setRootDir: (rootDir) => set({ rootDir })
}))
