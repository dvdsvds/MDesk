import { useEffect } from 'react'
import { useSettingsStore } from './settingsStore'
import { findTheme, type ThemePreference } from '../utils/themes'

/**
 * 고른 테마를 <html data-theme="테마 id" data-mode="light|dark"> 속성에 반영한다.
 * 색 값은 assets/theme.css의 data-theme 블록에, 밝기별로 공통인 값(파일 아이콘·csv 열 색)은
 * data-mode 블록에 있다.
 */
export function applyTheme(pref: ThemePreference): void {
  const theme = findTheme(pref)
  const root = document.documentElement
  root.setAttribute('data-theme', theme.id)
  root.setAttribute('data-mode', theme.mode)
}

// 첫 화면을 그리기 전에 한 번 적용해서 색이 깜빡이지 않게 한다. 설정은 localStorage에서 바로 읽힌다
applyTheme(useSettingsStore.getState().theme)

export function useAppliedTheme(): void {
  const theme = useSettingsStore((state) => state.theme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])
}
