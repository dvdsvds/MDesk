import { app } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'

export type ChangeKind = '추가' | '변경' | '수정'

export interface ChangelogItem {
  kind: ChangeKind
  text: string
}

type ChangelogEntry = ChangelogItem[] | string

function changelogPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'changelog.json')
    : join(__dirname, '../../resources/changelog.json')
}

/** 예전 문자열 형식의 한 줄이 어떤 종류인지 문구로 가늠한다 */
function guessKind(text: string): ChangeKind {
  if (/문제|오류|해결|고침|수정/.test(text)) return '수정'
  if (/추가|새로/.test(text)) return '추가'
  return '변경'
}

function toItems(entry: ChangelogEntry): ChangelogItem[] {
  if (Array.isArray(entry)) return entry
  return entry
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter((line) => line.length > 0)
    .map((text) => ({ kind: guessKind(text), text: text.replace(/`/g, '') }))
}

export function readChangelogFor(version: string): ChangelogItem[] | null {
  try {
    const raw = readFileSync(changelogPath(), 'utf-8')
    const map = JSON.parse(raw) as Record<string, ChangelogEntry>
    const entry = map[version]
    return entry ? toItems(entry) : null
  } catch {
    return null
  }
}
