import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { basename, extname, isAbsolute, join, relative, sep } from 'path'
import { getRootDir } from '../workspace/paths'
import { sanitizeFileName } from '../workspace/fileOps'
import { getGoogleAccessToken, resetGoogleAccessToken } from './googleAuth'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const GOOGLE_APPS_PREFIX = 'application/vnd.google-apps.'
const ROOT_FOLDER_NAME = 'Mdesk'
const CACHE_DIR = '.drive'
const UPLOAD_DEBOUNCE_MS = 800

export interface DriveItem {
  id: string
  name: string
  folder: boolean
}

export type DriveResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; notConnected?: boolean }

export type UploadState = 'uploading' | 'done' | 'conflict' | 'error'
export interface UploadEvent {
  path: string
  state: UploadState
  message?: string
}

class NotConnectedError extends Error {}
class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

const ID_RE = /^[\w-]+$/
const assertId = (id: string): string => {
  if (!ID_RE.test(id)) throw new Error('올바르지 않은 Drive 항목입니다.')
  return id
}

async function driveFetch(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await getGoogleAccessToken()
  if (!token) throw new NotConnectedError('Google Drive에 연결되어 있지 않습니다.')
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` }
  })
  if (res.status === 401 && retry) {
    resetGoogleAccessToken()
    return driveFetch(url, init, false)
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      detail = body.error?.message ?? ''
    } catch {}
    throw new DriveError(detail || `Drive 요청에 실패했습니다 (${res.status})`, res.status)
  }
  return res
}

async function driveJson<T>(url: string, init?: RequestInit): Promise<T> {
  return (await (await driveFetch(url, init)).json()) as T
}

function failure(e: unknown): { ok: false; error: string; notConnected?: boolean } {
  if (e instanceof NotConnectedError) return { ok: false, error: e.message, notConnected: true }
  if (e instanceof TypeError) {
    return { ok: false, error: '인터넷에 연결되어 있지 않은 것 같습니다.' }
  }
  return { ok: false, error: e instanceof Error ? e.message : 'Drive 작업에 실패했습니다.' }
}

function configFile(): string {
  return join(app.getPath('userData'), 'cloud', 'drive.json')
}

function readRootId(): string | null {
  try {
    const parsed = JSON.parse(readFileSync(configFile(), 'utf-8')) as { rootId?: unknown }
    return typeof parsed.rootId === 'string' && ID_RE.test(parsed.rootId) ? parsed.rootId : null
  } catch {
    return null
  }
}

function writeRootId(rootId: string): void {
  mkdirSync(join(app.getPath('userData'), 'cloud'), { recursive: true })
  writeFileSync(configFile(), JSON.stringify({ rootId }), 'utf-8')
}

async function createFolderRaw(name: string, parentId: string): Promise<DriveItem> {
  const created = await driveJson<{ id: string; name: string }>(`${API}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] })
  })
  return { id: created.id, name: created.name, folder: true }
}

let verifiedRootId: string | null = null

/** Drive 내 `Mdesk` 폴더의 id. 없거나 지워졌으면 찾거나 새로 만든다. 확인은 실행당 한 번만 한다 */
async function ensureRootFolder(): Promise<string> {
  if (verifiedRootId) return verifiedRootId
  const id = await findOrCreateRootFolder()
  verifiedRootId = id
  return id
}

async function findOrCreateRootFolder(): Promise<string> {
  const saved = readRootId()
  if (saved) {
    try {
      const meta = await driveJson<{ trashed?: boolean }>(
        `${API}/files/${saved}?fields=trashed`
      )
      if (!meta.trashed) return saved
    } catch (e) {
      if (!(e instanceof DriveError && e.status === 404)) throw e
    }
  }
  const q = `name='${ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`
  const found = await driveJson<{ files: { id: string }[] }>(
    `${API}/files?${new URLSearchParams({ q, fields: 'files(id)', pageSize: '1' })}`
  )
  const id = found.files[0]?.id ?? (await createFolderRaw(ROOT_FOLDER_NAME, 'root')).id
  writeRootId(id)
  return id
}

async function parentOrRoot(parentId: string | null): Promise<string> {
  return parentId ? assertId(parentId) : ensureRootFolder()
}

export async function listDrive(folderId: string | null): Promise<DriveResult<{ items: DriveItem[] }>> {
  try {
    const parent = await parentOrRoot(folderId)
    const items: DriveItem[] = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({
        q: `'${parent}' in parents and trashed=false`,
        fields: 'nextPageToken,files(id,name,mimeType)',
        pageSize: '1000'
      })
      if (pageToken) params.set('pageToken', pageToken)
      const page = await driveJson<{
        nextPageToken?: string
        files: { id: string; name: string; mimeType: string }[]
      }>(`${API}/files?${params}`)
      for (const f of page.files) {
        const folder = f.mimeType === FOLDER_MIME
        if (!folder && f.mimeType.startsWith(GOOGLE_APPS_PREFIX)) continue
        items.push({ id: f.id, name: f.name, folder })
      }
      pageToken = page.nextPageToken
    } while (pageToken)
    items.sort((a, b) =>
      a.folder !== b.folder ? (a.folder ? -1 : 1) : a.name.localeCompare(b.name, 'ko', { numeric: true })
    )
    return { ok: true, items }
  } catch (e) {
    return failure(e)
  }
}

export async function createDriveFolder(
  parentId: string | null,
  name: string
): Promise<DriveResult<{ item: DriveItem }>> {
  try {
    return { ok: true, item: await createFolderRaw(name, await parentOrRoot(parentId)) }
  } catch (e) {
    return failure(e)
  }
}

function multipartBody(
  metadata: object,
  content: Buffer,
  mime: string
): { body: Buffer; boundary: string } {
  const boundary = `mdesk-${Date.now().toString(36)}`
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`
  )
  const tail = Buffer.from(`\r\n--${boundary}--`)
  return { body: Buffer.concat([head, content, tail]), boundary }
}

const MULTIPART_LIMIT = 4 * 1024 * 1024

async function createFileRaw(
  name: string,
  parentId: string,
  content: Buffer,
  mime = 'text/plain'
): Promise<{ item: DriveItem; md5: string }> {
  type Created = { id: string; name: string; md5Checksum?: string }
  let created: Created
  if (content.length <= MULTIPART_LIMIT) {
    const { body, boundary } = multipartBody({ name, parents: [parentId] }, content, mime)
    created = await driveJson<Created>(
      `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,md5Checksum`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: new Uint8Array(body)
      }
    )
  } else {
    const session = await driveFetch(
      `${UPLOAD_API}/files?uploadType=resumable&fields=id,name,md5Checksum`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mime,
          'X-Upload-Content-Length': String(content.length)
        },
        body: JSON.stringify({ name, parents: [parentId] })
      }
    )
    const location = session.headers.get('Location')
    if (!location?.startsWith(`${UPLOAD_API}/`))
      throw new Error('Drive 업로드를 시작하지 못했습니다.')
    created = await driveJson<Created>(location, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: new Uint8Array(content)
    })
  }
  return {
    item: { id: created.id, name: created.name, folder: false },
    md5: created.md5Checksum ?? ''
  }
}

/** 새 파일은 내용이 비어 있다는 걸 이미 아니까, 다시 내려받지 않고 복사본을 바로 만들어 준다 */
export async function createDriveFile(
  parentId: string | null,
  name: string
): Promise<DriveResult<{ item: DriveItem; path: string }>> {
  try {
    const { item, md5 } = await createFileRaw(name, await parentOrRoot(parentId), Buffer.alloc(0))
    const path = driveLocalPath(item.id, item.name)
    mkdirSync(cacheDirOf(item.id), { recursive: true })
    writeFileSync(path, '')
    writeMeta(item.id, { md5 })
    return { ok: true, item, path }
  } catch (e) {
    return failure(e)
  }
}

export async function renameDriveItem(id: string, name: string): Promise<DriveResult<object>> {
  try {
    await driveJson(`${API}/files/${assertId(id)}?fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    return { ok: true }
  } catch (e) {
    return failure(e)
  }
}

/** 완전히 지우지 않고 Drive 휴지통으로 보낸다. Drive에서 복원할 수 있다 */
export async function trashDriveItem(id: string): Promise<DriveResult<object>> {
  try {
    await driveJson(`${API}/files/${assertId(id)}?fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true })
    })
    discardCache(id)
    return { ok: true }
  } catch (e) {
    return failure(e)
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf'
}
const TEXT_EXTS = new Set(['.md', '.markdown', '.txt', '.csv', '.tsv', '.json', '.yaml', '.yml'])

function mimeOf(name: string): string {
  const ext = extname(name).toLowerCase()
  if (TEXT_EXTS.has(ext)) return 'text/plain'
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

/** 로컬 탐색기의 `이름 2.md`와 같은 규칙으로 겹치지 않는 이름을 고른다 */
function uniqueDriveName(taken: Set<string>, name: string): string {
  const ext = extname(name)
  const stem = ext ? name.slice(0, -ext.length) : name
  let candidate = name
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${stem} ${n}${ext}`
  return candidate
}

async function childNames(parentId: string): Promise<Set<string>> {
  const names = new Set<string>()
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: `'${parentId}' in parents and trashed=false`,
      fields: 'nextPageToken,files(name)',
      pageSize: '1000'
    })
    if (pageToken) params.set('pageToken', pageToken)
    const page = await driveJson<{ nextPageToken?: string; files: { name: string }[] }>(
      `${API}/files?${params}`
    )
    for (const f of page.files) names.add(f.name.toLowerCase())
    pageToken = page.nextPageToken
  } while (pageToken)
  return names
}

export interface MovedFile {
  from: string
  to: string
}

/** 작업 공간의 파일이나 폴더를 Drive 폴더로 올린다. 폴더는 안의 구조 그대로 올린다(`.`으로 시작하는 항목은 뺀다). */
export async function uploadLocalEntry(
  sourcePath: string,
  parentId: string | null
): Promise<DriveResult<{ item: DriveItem; moved: MovedFile[] }>> {
  try {
    const root = getRootDir()
    const rel = relative(root, sourcePath)
    if (
      !rel ||
      rel.startsWith('..') ||
      isAbsolute(rel) ||
      rel.split(sep).some((p) => p.startsWith('.'))
    ) {
      throw new Error('작업 공간 안의 파일만 Drive로 옮길 수 있습니다.')
    }
    if (!existsSync(sourcePath)) throw new Error('옮길 파일을 찾을 수 없습니다.')
    const parent = await parentOrRoot(parentId)
    const name = uniqueDriveName(await childNames(parent), basename(sourcePath))
    const moved: MovedFile[] = []

    const put = async (path: string, entryName: string, into: string): Promise<DriveItem> => {
      if (statSync(path).isDirectory()) {
        const folder = await createFolderRaw(entryName, into)
        for (const child of readdirSync(path)) {
          if (child.startsWith('.')) continue
          await put(join(path, child), child, folder.id)
        }
        return folder
      }
      const content = readFileSync(path)
      const { item, md5 } = await createFileRaw(entryName, into, content, mimeOf(entryName))
      const copy = driveLocalPath(item.id, item.name)
      mkdirSync(cacheDirOf(item.id), { recursive: true })
      writeFileSync(copy, content)
      writeMeta(item.id, { md5 })
      moved.push({ from: path, to: copy })
      return item
    }

    const item = await put(sourcePath, name, parent)
    return { ok: true, item, moved }
  } catch (e) {
    return failure(e)
  }
}

interface CacheMeta {
  md5: string
}

const cacheDirOf = (id: string): string => join(getRootDir(), CACHE_DIR, id)
const metaPathOf = (id: string): string => join(cacheDirOf(id), '.meta.json')

export function driveLocalPath(id: string, name: string): string {
  return join(cacheDirOf(assertId(id)), sanitizeFileName(name))
}

function readMeta(id: string): CacheMeta | null {
  try {
    return JSON.parse(readFileSync(metaPathOf(id), 'utf-8')) as CacheMeta
  } catch {
    return null
  }
}

function writeMeta(id: string, meta: CacheMeta): void {
  mkdirSync(cacheDirOf(id), { recursive: true })
  writeFileSync(metaPathOf(id), JSON.stringify(meta), 'utf-8')
}

function discardCache(id: string): void {
  rmSync(cacheDirOf(id), { recursive: true, force: true })
}

/** 열려 있는 탭은 그대로 두고, 이 파일의 이전 이름으로 남은 복사본만 지운다 */
function removeStaleCopies(id: string, keepName: string): void {
  const dir = cacheDirOf(id)
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    if (entry !== keepName && entry !== '.meta.json') rmSync(join(dir, entry), { force: true })
  }
}

export async function downloadDriveFile(
  id: string,
  name: string
): Promise<DriveResult<{ path: string }>> {
  try {
    assertId(id)
    const [meta, res] = await Promise.all([
      driveJson<{ md5Checksum?: string }>(`${API}/files/${id}?fields=md5Checksum`),
      driveFetch(`${API}/files/${id}?alt=media`)
    ])
    const data = Buffer.from(await res.arrayBuffer())
    const path = driveLocalPath(id, name)
    mkdirSync(cacheDirOf(id), { recursive: true })
    writeFileSync(path, data)
    removeStaleCopies(id, basename(path))
    writeMeta(id, { md5: meta.md5Checksum ?? '' })
    return { ok: true, path }
  } catch (e) {
    return failure(e)
  }
}

/** Drive 임시 사본 경로면 그 파일의 Drive ID를 돌려준다 */
export function driveIdOfPath(filePath: string): string | null {
  const parts = relative(getRootDir(), filePath).split(sep)
  return parts.length === 3 && parts[0] === CACHE_DIR && ID_RE.test(parts[1]) ? parts[1] : null
}

const uploadTimers = new Map<string, ReturnType<typeof setTimeout>>()
const uploading = new Set<string>()
let emit: (event: UploadEvent) => void = () => {}

export function setUploadListener(listener: (event: UploadEvent) => void): void {
  emit = listener
}

/** 저장된 파일이 Drive 복사본이면 잠시 뒤 올린다. 연달아 저장하면 마지막 것만 올린다 */
export function onNoteSaved(filePath: string): void {
  const id = driveIdOfPath(filePath)
  if (!id) return
  const timer = uploadTimers.get(id)
  if (timer) clearTimeout(timer)
  uploadTimers.set(
    id,
    setTimeout(() => {
      uploadTimers.delete(id)
      void upload(id, filePath)
    }, UPLOAD_DEBOUNCE_MS)
  )
}

async function upload(id: string, filePath: string): Promise<void> {
  if (uploading.has(id)) {
    onNoteSaved(filePath)
    return
  }
  uploading.add(id)
  emit({ path: filePath, state: 'uploading' })
  try {
    const content = readFileSync(filePath)
    const remote = await driveJson<{
      md5Checksum?: string
      trashed?: boolean
      parents?: string[]
    }>(`${API}/files/${id}?fields=md5Checksum,trashed,parents`)
    if (remote.trashed) {
      emit({ path: filePath, state: 'error', message: 'Drive에서 삭제된 파일이라 올리지 못했습니다.' })
      return
    }
    const known = readMeta(id)
    if (known && (remote.md5Checksum ?? '') !== known.md5) {
      const ext = extname(filePath)
      const stem = basename(filePath, ext)
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.')
      const parent = remote.parents?.[0] ?? (await ensureRootFolder())
      await createFileRaw(`${stem} (충돌 ${stamp})${ext}`, parent, content)
      emit({
        path: filePath,
        state: 'conflict',
        message: 'Drive에서 다른 곳이 먼저 수정해서, 이 내용은 "충돌" 사본으로 올렸습니다.'
      })
      return
    }
    const updated = await driveJson<{ md5Checksum?: string }>(
      `${UPLOAD_API}/files/${id}?uploadType=media&fields=md5Checksum`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'text/plain' },
        body: new Uint8Array(content)
      }
    )
    writeMeta(id, { md5: updated.md5Checksum ?? '' })
    emit({ path: filePath, state: 'done' })
  } catch (e) {
    const f = failure(e)
    emit({
      path: filePath,
      state: 'error',
      message: `Drive에 올리지 못했습니다. ${f.error} 다시 저장하면 다시 시도합니다.`
    })
  } finally {
    uploading.delete(id)
  }
}
