import { useEffect } from 'react'
import { useSettingsStore } from './settingsStore'

/** settingsStore의 글꼴 설정을 CSS 변수(assets/theme.css의 기본값)에 */
export function useAppliedFonts(): void {
  const editorFontFamily = useSettingsStore((s) => s.editorFontFamily)
  const editorFontSize = useSettingsStore((s) => s.editorFontSize)
  const editorLineHeight = useSettingsStore((s) => s.editorLineHeight)

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--font-editor', editorFontFamily)
    root.setProperty('--editor-font-size', `${editorFontSize}px`)
    root.setProperty('--editor-line-height', String(editorLineHeight))
  }, [
    editorFontFamily,
    editorFontSize,
    editorLineHeight
  ])
}
