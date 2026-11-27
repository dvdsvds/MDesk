import { useEffect } from 'react'
import { useSettingsStore } from './settingsStore'

/** 화면 확대 비율을 적용한다 */
export function useAppliedZoom(): void {
  const uiZoom = useSettingsStore((s) => s.uiZoom)

  useEffect(() => {
    document.body.style.setProperty('zoom', String(uiZoom / 100))
  }, [uiZoom])
}
