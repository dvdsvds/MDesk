import { closeSync, openSync, readSync, readdirSync, statSync } from 'fs'
import { extname, join } from 'path'

export interface FolderFile {
  path: string
  name: string
  /** 마지막 수정 시각(ms) */
  mtime: number
  /** 본문 첫 줄 미리보기. 텍스트 파일이 아니면 빈 문자열 */
  snippet: string
}

const SNIPPET_EXTS = new Set(['.md', '.markdown', '.txt'])
const HEAD_BYTES = 4096
const SNIPPET_MAX = 140

function readHead(filePath: string): string {
  const fd = openSync(filePath, 'r')
  try {
    const buf = Buffer.alloc(HEAD_BYTES)
    const n = readSync(fd, buf, 0, HEAD_BYTES, 0)
    return buf.subarray(0, n).toString('utf-8')
  } finally {
    closeSync(fd)
  }
}

/** 본문에서 미리보기로 보여 줄 첫 줄. front matter, 빈 줄, 제목 줄은 건너뛰고 마크다운 기호를 걷어 낸다 */
export function snippetOf(text: string): string {
  let body = text.replace(/^﻿/, '')
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3)
    if (end !== -1) body = body.slice(body.indexOf('\n', end + 1) + 1)
  }
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || /^#{1,6}\s/.test(line) || /^(```|~~~|---|\*\*\*|___)/.test(line)) continue
    const cleaned = line
      .replace(/^(?:>\s*)+/, '')
      .replace(/^(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
      .replace(/!?\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_m, t: string, a?: string) => a || t)
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~`]+/g, '')
      .trim()
    if (cleaned) return cleaned.length > SNIPPET_MAX ? cleaned.slice(0, SNIPPET_MAX) : cleaned
  }
  return ''
}

/** 폴더 바로 아래의 파일(하위 폴더와 `.`으로 시작하는 항목 제외). 최근 수정한 순서 */
export function listFolderFiles(dir: string): FolderFile[] {
  let entries: import('fs').Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files: FolderFile[] = []
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    let mtime = 0
    try {
      mtime = statSync(path).mtimeMs
    } catch {
      continue
    }
    let snippet = ''
    if (SNIPPET_EXTS.has(extname(entry.name).toLowerCase())) {
      try {
        snippet = snippetOf(readHead(path))
      } catch {
        snippet = ''
      }
    }
    files.push({ path, name: entry.name, mtime, snippet })
  }
  return files.sort((a, b) => b.mtime - a.mtime)
}
