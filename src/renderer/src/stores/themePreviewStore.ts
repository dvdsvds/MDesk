import { create } from 'zustand'
import type { ThemeId } from '../utils/themes'

/**
 * 설정에서 색 테마 목록에 마우스를 올린 테마. 목록(드롭다운)과 위쪽 미리보기 카드가
 * 서로 다른 설정 항목이라 이 값으로 연결한다. 저장하지 않는다.
 */
interface ThemePreviewState {
  hovered: ThemeId | null
  setHovered: (id: ThemeId | null) => void
}

export const useThemePreviewStore = create<ThemePreviewState>((set) => ({
  hovered: null,
  setHovered: (id) => set({ hovered: id })
}))
