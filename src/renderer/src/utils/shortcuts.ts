export interface ShortcutMap {
  newNote: string
  toggleSettings: string
  copyPathAbsolute: string
  copyPathRelative: string
  diffApply: string
  diffRestore: string
  save: string
  search: string
  zoomIn: string
  zoomOut: string
  zoomReset: string
  toggleToc: string
  todoDashboard: string
  backlinks: string
  toggleSidebar: string
  graph: string
  dailyNote: string
  viewEditor: string
  viewSplit: string
  viewPreview: string
  renameItem: string
  newFolder: string
  revealItem: string
  exportItem: string
  compareItem: string
  historyItem: string
}

export type ShortcutAction = keyof ShortcutMap

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  newNote: 'Ctrl+N',
  toggleSettings: 'Ctrl+,',
  copyPathAbsolute: 'Ctrl+Shift+C',
  copyPathRelative: 'Ctrl+Alt+C',
  diffApply: 'Ctrl+Enter',
  diffRestore: 'Ctrl+Backspace',
  save: 'Ctrl+S',
  search: 'Ctrl+P',
  zoomIn: 'Ctrl+=',
  zoomOut: 'Ctrl+-',
  zoomReset: 'Ctrl+0',
  toggleToc: 'Ctrl+Shift+O',
  todoDashboard: 'Ctrl+Shift+T',
  backlinks: 'Ctrl+Shift+B',
  toggleSidebar: 'Ctrl+Shift+E',
  graph: 'Ctrl+Shift+G',
  dailyNote: 'Ctrl+Shift+D',
  viewEditor: 'Ctrl+Alt+I',
  viewSplit: 'Ctrl+Alt+O',
  viewPreview: 'Ctrl+Alt+P',
  renameItem: 'F2',
  newFolder: 'Ctrl+Shift+N',
  revealItem: 'Ctrl+Alt+R',
  exportItem: 'Ctrl+Alt+E',
  compareItem: 'Ctrl+Alt+D',
  historyItem: 'Ctrl+Alt+H'
}

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  newNote: '새 파일',
  toggleSettings: '설정 열기/닫기',
  copyPathAbsolute: '절대 경로 복사',
  copyPathRelative: '상대 경로 복사',
  diffApply: '차이 화면 적용하기',
  diffRestore: '차이 화면 복구하기',
  save: '저장',
  search: '빠른 검색',
  zoomIn: 'UI 확대',
  zoomOut: 'UI 축소',
  zoomReset: 'UI 배율 초기화',
  toggleToc: '목차 패널 열기/포커스',
  todoDashboard: '할일 대시보드',
  backlinks: '백링크 패널',
  toggleSidebar: '사이드바 접기/펼치기',
  graph: '그래프 뷰',
  dailyNote: '오늘 데일리 노트',
  viewEditor: '보기: 에디터만',
  viewSplit: '보기: 분할',
  viewPreview: '보기: 미리보기만',
  renameItem: '사이드바: 이름 바꾸기',
  newFolder: '사이드바: 새 폴더',
  revealItem: '사이드바: 폴더에서 보기',
  exportItem: '사이드바: 폴더 내보내기',
  compareItem: '사이드바: 변경 내용 비교',
  historyItem: '사이드바: 버전 기록'
}

function normalizeKey(key: string): string {
  const lower = key.toLowerCase()
  return lower === '+' ? '=' : lower
}

function displayKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key
}

const MODIFIER_KEYS = ['Control', 'Meta', 'Alt', 'Shift']

export function eventToShortcut(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.includes(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  parts.push(displayKey(e.key))
  return parts.join('+')
}

export function matchesShortcut(e: KeyboardEvent, combo: string | undefined): boolean {
  if (!combo) return false
  const parts = combo.split('+')
  const rawKey = parts[parts.length - 1]
  const wantCtrl = parts.includes('Ctrl')
  const wantAlt = parts.includes('Alt')
  const wantShift = parts.includes('Shift')
  if (wantCtrl !== (e.ctrlKey || e.metaKey)) return false
  if (wantAlt !== e.altKey) return false
  if (wantShift !== e.shiftKey) return false
  return normalizeKey(rawKey) === normalizeKey(e.key)
}

export function findConflict(
  shortcuts: ShortcutMap,
  action: ShortcutAction,
  combo: string
): ShortcutAction | null {
  for (const key of Object.keys(shortcuts) as ShortcutAction[]) {
    if (key !== action && shortcuts[key] === combo) return key
  }
  return null
}