import { create } from 'zustand'
import type { NoteProps, PropertyKey } from '../utils/noteProperties'

interface NotePropsState {
  byPath: Record<string, NoteProps>
  load: () => Promise<void>
  setProps: (filePath: string, updates: Partial<Record<PropertyKey, string | null>>) => void
}

export const useNotePropsStore = create<NotePropsState>((set, get) => ({
  byPath: {},

  load: async () => {
    set({ byPath: (await window.api.props.getAll()) as Record<string, NoteProps> })
  },

  setProps: (filePath, updates) => {
    const next: NoteProps = { ...(get().byPath[filePath] ?? {}) }
    for (const [key, value] of Object.entries(updates) as [PropertyKey, string | null][]) {
      if (value) next[key] = value
      else delete next[key]
    }
    set((s) => ({ byPath: { ...s.byPath, [filePath]: next } }))
    void window.api.props.set(filePath, next as Record<string, string>)
  },
}))
