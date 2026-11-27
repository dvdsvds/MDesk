import { useEffect } from 'react'
import { useSettingsStore } from './settingsStore'
import { findTheme, type ThemePreference } from '../utils/themes'

/** 고른 테마를 <html data-theme="테마 id" data-mode="light|dark"> 속성에 반영한다. */
export function applyTheme(pref: ThemePreference): void {
  const theme = findTheme(pref)
  const root = document.documentElement
  root.setAttribute('data-theme', theme.id)
  root.setAttribute('data-mode', theme.mode)
}

applyTheme(useSettingsStore.getState().theme)

export function useAppliedTheme(): void {
  const theme = useSettingsStore((state) => state.theme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])
}
