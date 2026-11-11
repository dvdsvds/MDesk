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
  viewEditor: string
  viewSplit: string
  viewPreview: string
  renameItem: string
  newFolder: string
  revealItem: string
  exportItem: string
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
  viewEditor: 'Ctrl+Alt+I',
  viewSplit: 'Ctrl+Alt+O',
  viewPreview: 'Ctrl+Alt+P',
  renameItem: 'F2',
  newFolder: 'Ctrl+Shift+N',
  revealItem: 'Ctrl+Alt+R',
  exportItem: 'Ctrl+Alt+E'
}

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  newNote: '새 노트',
  toggleSettings: '설정',
  copyPathAbsolute: '절대 경로 복사',
  copyPathRelative: '상대 경로 복사',
  diffApply: '적용',
  diffRestore: '되돌리기',
  save: '저장',
  search: '검색',
  zoomIn: '확대',
  zoomOut: '축소',
  zoomReset: '기본 크기',
  toggleToc: '목차',
  todoDashboard: '할 일',
  backlinks: '백링크',
  toggleSidebar: '열기 닫기',
  graph: '그래프',
  viewEditor: '에디터',
  viewSplit: '분할',
  viewPreview: '미리보기',
  renameItem: '이름 바꾸기',
  newFolder: '새 폴더',
  revealItem: '탐색기에서 보기',
  exportItem: '내보내기'
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
