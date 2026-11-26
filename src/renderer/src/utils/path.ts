export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function dirOf(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx >= 0 ? path.slice(0, idx) : path
}

export function sepOf(path: string): string {
  return path.includes('\\') ? '\\' : '/'
}

export function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, dot), ext: name.slice(dot) }
}

export function newFileNameFor(typed: string): string {
  const trimmed = typed.trim()
  return /^(.*[^.\s])(\.[A-Za-z0-9]{1,8})$/.test(trimmed) ? trimmed : `${trimmed || 'new'}.md`
}
/** 파일이 든 폴더를 작업 폴더 이름부터 " / "로 이어 보여 준다(예: Mdesk / 프로젝트 / MarkRoom) */
export function folderTrail(rootDir: string | null, filePath: string): string {
  const dir = dirOf(filePath)
  if (!rootDir) return fileNameOf(dir)
  const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '')
  const root = norm(rootDir)
  const d = norm(dir)
  const rootName = fileNameOf(root)
  if (d.toLowerCase() === root.toLowerCase()) return rootName
  if (!d.toLowerCase().startsWith(root.toLowerCase() + '/')) return fileNameOf(d)
  return [rootName, ...d.slice(root.length + 1).split('/')].join(' / ')
}
