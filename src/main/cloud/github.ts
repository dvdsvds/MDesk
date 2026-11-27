import { app, safeStorage, shell } from 'electron'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join, relative, sep } from 'path'
import { getRootDir } from '../workspace/paths'

const API = 'https://api.github.com'
const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const SCOPE = 'public_repo'
const CACHE_DIR = '.ghmd'
const LINKS_FILE = 'links.json'
const MD_RE = /\.(md|markdown)$/i
const NAME_RE = /^[\w.-]+$/

export interface GithubStatus {
  configured: boolean
  connected: boolean
  login: string | null
  avatar: string | null
}

export interface GithubLink {
  id: string
  owner: string
  repo: string
  branch: string
  dir: string
  files: Record<string, string>
}

export interface GithubLinkView {
  id: string
  owner: string
  repo: string
  branch: string
  dir: string
  files: { path: string; localPath: string; changed: boolean }[]
}

export interface DeviceCode {
  userCode: string
  verificationUri: string
}

export type GithubResult<T> =
  ({ ok: true } & T) | { ok: false; error: string; notConnected?: boolean }

interface StoredLogin {
  token: string
  login: string | null
}

let cachedLogin: StoredLogin | null | undefined
let pendingPoll: { cancelled: boolean } | null = null

const clientId = (): string => import.meta.env.MAIN_VITE_GH_OAUTH_CLIENT_ID ?? ''

function loginFile(): string {
  return join(app.getPath('userData'), 'cloud', 'github.bin')
}

async function readLogin(): Promise<StoredLogin | null> {
  if (cachedLogin !== undefined) return cachedLogin
  try {
    const file = loginFile()
    if (!existsSync(file) || !(await safeStorage.isAsyncEncryptionAvailable())) return null
    const { result } = await safeStorage.decryptStringAsync(readFileSync(file))
    const parsed = JSON.parse(result) as StoredLogin
    cachedLogin = typeof parsed.token === 'string' ? parsed : null
  } catch {
    cachedLogin = null
  }
  return cachedLogin
}

async function writeLogin(login: StoredLogin): Promise<void> {
  mkdirSync(dirname(loginFile()), { recursive: true })
  writeFileSync(loginFile(), await safeStorage.encryptStringAsync(JSON.stringify(login)))
  cachedLogin = login
}

class GithubError extends Error {
  constructor(
    message: string,
    readonly notConnected = false
  ) {
    super(message)
  }
}

function failure(e: unknown): { ok: false; error: string; notConnected?: boolean } {
  if (e instanceof GithubError) return { ok: false, error: e.message, notConnected: e.notConnected }
  return { ok: false, error: 'GitHub에 연결하지 못했습니다. 인터넷 연결을 확인하십시오.' }
}

/** 로그인 토큰을 붙여 GitHub API를 호출한다 */
async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await ghResponse(path, init)).json() as Promise<T>
}

/** 로그인 토큰을 붙여 GitHub API 응답 받기 */
async function ghResponse(path: string, init: RequestInit = {}): Promise<Response> {
  const login = await readLogin()
  if (!login) throw new GithubError('GitHub에 연결되어 있지 않습니다.', true)
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${login.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    }
  })
  if (res.status === 401) {
    clearLogin()
    throw new GithubError('GitHub 로그인이 만료되었습니다. 다시 로그인이 필요합니다.', true)
  }
  if (res.status === 404) throw new GithubError('저장소나 경로를 찾지 못했습니다.')
  if (res.status === 403) throw new GithubError('이 저장소에 접근할 권한이 없습니다.')
  if (res.status === 409) throw new GithubError('저장소가 비어 있거나 브랜치가 바뀌었습니다.')
  if (!res.ok) throw new GithubError(`GitHub 요청이 실패했습니다. (${res.status})`)
  return res
}

function clearLogin(): void {
  cachedLogin = null
  avatarCache = undefined
  rmSync(loginFile(), { force: true })
}

let avatarCache: string | null | undefined

/** 프로필 사진을 받아 data URL로 돌려준다. 한 번 받은 것은 다시 쓴다 */
async function loadAvatar(): Promise<string | null> {
  if (avatarCache !== undefined) return avatarCache
  try {
    const user = await gh<{ avatar_url?: string }>('/user')
    if (!user.avatar_url) return (avatarCache = null)
    const url = new URL(user.avatar_url)
    url.searchParams.set('s', '64')
    const res = await fetch(url)
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/')) return (avatarCache = null)
    const data = Buffer.from(await res.arrayBuffer()).toString('base64')
    avatarCache = `data:${type};base64,${data}`
  } catch {
    return null
  }
  return avatarCache
}

export async function githubStatus(): Promise<GithubStatus> {
  const login = await readLogin()
  return {
    configured: clientId() !== '',
    connected: !!login,
    login: login?.login ?? null,
    avatar: login ? await loadAvatar() : null
  }
}

/** 기기 인증을 시작해 코드를 돌려주고, 브라우저에서 인증 페이지를 연다 */
export async function startGithubLogin(): Promise<GithubResult<DeviceCode>> {
  if (!clientId()) return { ok: false, error: 'GitHub에 연결할 수 없습니다.' }
  try {
    const res = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId(), scope: SCOPE })
    })
    const data = (await res.json()) as {
      device_code?: string
      user_code?: string
      verification_uri?: string
      interval?: number
      expires_in?: number
    }
    if (!data.device_code || !data.user_code || !data.verification_uri) {
      return { ok: false, error: 'GitHub 인증을 시작하지 못했습니다.' }
    }
    if (pendingPoll) pendingPoll.cancelled = true
    pendingPoll = { cancelled: false }
    pollState = {
      deviceCode: data.device_code,
      interval: data.interval ?? 5,
      expiresAt: Date.now() + (data.expires_in ?? 900) * 1000,
      poll: pendingPoll
    }
    void shell.openExternal(data.verification_uri)
    return { ok: true, userCode: data.user_code, verificationUri: data.verification_uri }
  } catch (e) {
    return failure(e)
  }
}

let pollState: {
  deviceCode: string
  interval: number
  expiresAt: number
  poll: { cancelled: boolean }
} | null = null

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** 사용자가 브라우저에서 코드를 입력할 때까지 기다렸다가 토큰을 저장한다 */
export async function finishGithubLogin(): Promise<GithubResult<{ login: string | null }>> {
  const state = pollState
  if (!state) return { ok: false, error: 'GitHub 인증이 시작되지 않았습니다.' }
  let interval = state.interval
  try {
    while (Date.now() < state.expiresAt) {
      await wait(interval * 1000)
      if (state.poll.cancelled) return { ok: false, error: 'GitHub 연결을 취소했습니다.' }
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId(),
          device_code: state.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      })
      const data = (await res.json()) as {
        access_token?: string
        error?: string
        interval?: number
      }
      if (data.access_token) {
        await writeLogin({ token: data.access_token, login: null })
        const user = await gh<{ login?: string }>('/user')
        await writeLogin({ token: data.access_token, login: user.login ?? null })
        pollState = null
        return { ok: true, login: user.login ?? null }
      }
      if (data.error === 'slow_down') interval = data.interval ?? interval + 5
      else if (data.error === 'access_denied')
        return { ok: false, error: 'GitHub 연결을 거부했습니다.' }
      else if (data.error === 'expired_token') break
      else if (data.error !== 'authorization_pending') {
        return { ok: false, error: 'GitHub 인증에 실패했습니다.' }
      }
    }
    return { ok: false, error: '인증 시간이 만료되었습니다. 다시 로그인이 필요합니다.' }
  } catch (e) {
    return failure(e)
  } finally {
    if (pollState === state) pollState = null
  }
}

export function cancelGithubLogin(): void {
  if (pollState) pollState.poll.cancelled = true
  pollState = null
}

export function disconnectGithub(): void {
  cancelGithubLogin()
  clearLogin()
}

const cacheRoot = (): string => join(getRootDir(), CACHE_DIR)
const linksPath = (): string => join(cacheRoot(), LINKS_FILE)
const linkDirOf = (id: string): string => join(cacheRoot(), id)

function readLinks(): GithubLink[] {
  try {
    return JSON.parse(readFileSync(linksPath(), 'utf-8')) as GithubLink[]
  } catch {
    return []
  }
}

function writeLinks(links: GithubLink[]): void {
  mkdirSync(cacheRoot(), { recursive: true })
  writeFileSync(linksPath(), JSON.stringify(links, null, 2), 'utf-8')
}

/** git이 계산하는 것과 같은 blob SHA */
function blobSha(content: Buffer): string {
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex')
}

function localPathOf(link: GithubLink, path: string): string {
  return join(linkDirOf(link.id), ...path.split('/'))
}

function isChanged(link: GithubLink, path: string): boolean {
  try {
    return blobSha(readFileSync(localPathOf(link, path))) !== link.files[path]
  } catch {
    return false
  }
}

function viewOf(link: GithubLink): GithubLinkView {
  return {
    id: link.id,
    owner: link.owner,
    repo: link.repo,
    branch: link.branch,
    dir: link.dir,
    files: Object.keys(link.files)
      .sort((a, b) => a.localeCompare(b))
      .map((path) => ({ path, localPath: localPathOf(link, path), changed: isChanged(link, path) }))
  }
}

/** 로컬 사본 경로에 해당하는 저장소 원본 주소 기준과 저장소 안 경로 */
export function githubRawInfo(localPath: string): { rawBase: string; path: string } | null {
  const parts = relative(cacheRoot(), localPath).split(sep)
  if (parts.length < 2 || parts[0] === '..') return null
  const link = readLinks().find((l) => l.id === parts[0])
  if (!link) return null
  const enc = (s: string): string => s.split('/').map(encodeURIComponent).join('/')
  return {
    rawBase: `https://raw.githubusercontent.com/${enc(link.owner)}/${enc(link.repo)}/${enc(link.branch)}/`,
    path: parts.slice(1).join('/')
  }
}

const proxyCache = new Map<string, string | null>()
const PROXY_HOST_RE = /^https:\/\/[\w.-]+\.githubusercontent\.com\//

/** HTML 속성 값의 엔티티 풀기 */
function decodeAttr(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** 외부 이미지 주소를 GitHub 이미지 프록시(camo) 주소로 바꾸기 */
export async function githubImageProxyUrls(
  urls: string[]
): Promise<GithubResult<{ urls: Record<string, string | null> }>> {
  const wanted = [...new Set(urls.filter((u) => /^https?:\/\/[^\s<>]+$/i.test(u)))]
    .filter((u) => !proxyCache.has(u))
    .slice(0, 100)
  try {
    if (wanted.length) {
      const res = await ghResponse('/markdown', {
        method: 'POST',
        body: JSON.stringify({
          text: wanted.map((u) => `![](<${u}>)`).join('\n\n'),
          mode: 'markdown'
        })
      })
      const html = await res.text()
      const srcs = [...html.matchAll(/<img\s[^>]*>/g)].map((m) =>
        decodeAttr(/\ssrc="([^"]*)"/.exec(m[0])?.[1] ?? '')
      )
      wanted.forEach((u, i) => {
        const src = srcs.length === wanted.length ? srcs[i] : ''
        proxyCache.set(u, PROXY_HOST_RE.test(src) ? src : null)
      })
    }
    const out: Record<string, string | null> = {}
    for (const u of urls) out[u] = proxyCache.get(u) ?? null
    return { ok: true, urls: out }
  } catch (e) {
    return failure(e)
  }
}

export function listGithubLinks(): GithubLinkView[] {
  return readLinks().map(viewOf)
}

export interface GithubRepo {
  owner: string
  repo: string
}

/** 로그인한 계정이 볼 수 있는 공개 저장소 목록 (최근 수정순) */
export async function listGithubRepos(): Promise<GithubResult<{ repos: GithubRepo[] }>> {
  try {
    const repos: GithubRepo[] = []
    for (let page = 1; page <= 5; page++) {
      const list = await gh<{ name: string; owner: { login: string }; private: boolean }[]>(
        `/user/repos?visibility=public&sort=updated&per_page=100&page=${page}`
      )
      for (const r of list) if (!r.private) repos.push({ owner: r.owner.login, repo: r.name })
      if (list.length < 100) break
    }
    return { ok: true, repos }
  } catch (e) {
    return failure(e)
  }
}

/** "owner/repo" 또는 GitHub 주소에서 저장소 이름을 꺼낸다 */
function parseRepo(input: string): { owner: string; repo: string } | null {
  const m = /^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(input.trim())
  return m && NAME_RE.test(m[1]) && NAME_RE.test(m[2]) ? { owner: m[1], repo: m[2] } : null
}

/** 공개 저장소의 md 파일 목록을 가져온다 */
export async function browseGithubRepo(
  repoInput: string
): Promise<
  GithubResult<{ owner: string; repo: string; branch: string; dir: string; files: string[] }>
> {
  const parsed = parseRepo(repoInput)
  if (!parsed) return { ok: false, error: '저장소 형식이 올바르지 않습니다. (예: owner/repo)' }
  try {
    const { owner, repo } = parsed
    const info = await gh<{
      private?: boolean
      default_branch?: string
      name?: string
      owner?: { login?: string }
    }>(`/repos/${owner}/${repo}`)
    if (info.private) return { ok: false, error: '공개 저장소만 연결할 수 있습니다.' }
    const branch = info.default_branch ?? 'main'
    const dir = ''
    const tree = await gh<{ tree: { path: string; type: string }[]; truncated?: boolean }>(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
    )
    const prefix = dir ? `${dir}/` : ''
    const files = tree.tree
      .filter((t) => t.type === 'blob' && t.path.startsWith(prefix) && MD_RE.test(t.path))
      .map((t) => t.path)
      .sort((a, b) => a.localeCompare(b))
    return {
      ok: true,
      owner: info.owner?.login ?? owner,
      repo: info.name ?? repo,
      branch,
      dir,
      files
    }
  } catch (e) {
    return failure(e)
  }
}

const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/')

async function downloadFile(link: GithubLink, path: string): Promise<string> {
  const data = await gh<{ content?: string; sha: string }>(
    `/repos/${link.owner}/${link.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(link.branch)}`
  )
  const content = Buffer.from(data.content ?? '', 'base64')
  const local = localPathOf(link, path)
  mkdirSync(dirname(local), { recursive: true })
  writeFileSync(local, content)
  return blobSha(content)
}

/** 고른 md 파일을 내려받아 연결에 추가한다. 같은 저장소와 디렉터리면 파일 목록을 바꾼다 */
export async function addGithubLink(args: {
  owner: string
  repo: string
  branch: string
  dir: string
  files: string[]
}): Promise<GithubResult<{ link: GithubLinkView }>> {
  try {
    const { owner, repo, branch, dir } = args
    if (!NAME_RE.test(owner) || !NAME_RE.test(repo))
      return { ok: false, error: '저장소 이름이 올바르지 않습니다.' }
    const prefix = dir ? `${dir}/` : ''
    const wanted = args.files.filter(
      (f) => f.startsWith(prefix) && MD_RE.test(f) && !f.split('/').includes('..')
    )
    const links = readLinks()
    const id = `${owner}~${repo}~${branch}`.replace(/[^\w.~-]/g, '_')
    const existing = links.find((l) => l.id === id)
    const link: GithubLink = existing ?? { id, owner, repo, branch, dir, files: {} }
    link.dir = dir
    for (const path of Object.keys(link.files)) {
      if (wanted.includes(path)) continue
      if (isChanged(link, path)) continue
      rmSync(localPathOf(link, path), { force: true })
      delete link.files[path]
    }
    for (const path of wanted) {
      if (link.files[path] && existsSync(localPathOf(link, path))) continue
      link.files[path] = await downloadFile(link, path)
    }
    writeLinks(existing ? links : [...links, link])
    return { ok: true, link: viewOf(link) }
  } catch (e) {
    return failure(e)
  }
}

export function removeGithubLink(id: string): void {
  const links = readLinks()
  const link = links.find((l) => l.id === id)
  if (!link) return
  rmSync(linkDirOf(link.id), { recursive: true, force: true })
  writeLinks(links.filter((l) => l.id !== id))
}

/** 수정한 파일을 하나의 커밋으로 올린다. 원격이 그사이 바뀐 파일이 있으면 올리지 않는다 */
export async function commitGithubLink(
  id: string,
  message: string
): Promise<GithubResult<{ count: number }>> {
  const links = readLinks()
  const link = links.find((l) => l.id === id)
  if (!link) return { ok: false, error: '연결한 저장소를 찾지 못했습니다.' }
  const changed = Object.keys(link.files).filter((p) => isChanged(link, p))
  if (changed.length === 0) return { ok: false, error: '수정한 파일이 없습니다.' }
  try {
    const base = `/repos/${link.owner}/${link.repo}`
    const ref = await gh<{ object: { sha: string } }>(
      `${base}/git/ref/heads/${encodeURIComponent(link.branch)}`
    )
    const head = await gh<{ tree: { sha: string } }>(`${base}/git/commits/${ref.object.sha}`)
    const remote = await gh<{ tree: { path: string; sha: string }[] }>(
      `${base}/git/trees/${head.tree.sha}?recursive=1`
    )
    const remoteSha = new Map(remote.tree.map((t) => [t.path, t.sha]))
    const conflicts = changed.filter((p) => remoteSha.get(p) !== link.files[p])
    if (conflicts.length > 0) {
      return {
        ok: false,
        error: `GitHub에서 먼저 수정된 파일이 있어 올리지 않았습니다: ${conflicts.join(', ')}`
      }
    }
    const contents = new Map(changed.map((p) => [p, readFileSync(localPathOf(link, p))]))
    const tree = await gh<{ sha: string }>(`${base}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: head.tree.sha,
        tree: changed.map((path) => ({
          path,
          mode: '100644',
          type: 'blob',
          content: contents.get(path)?.toString('utf-8') ?? ''
        }))
      })
    })
    const commit = await gh<{ sha: string }>(`${base}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] })
    })
    await gh(`${base}/git/refs/heads/${encodeURIComponent(link.branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha })
    })
    for (const [path, content] of contents) link.files[path] = blobSha(content)
    writeLinks(links)
    return { ok: true, count: changed.length }
  } catch (e) {
    return failure(e)
  }
}

let emitSaved: () => void = () => {}

export function setGithubSavedListener(listener: () => void): void {
  emitSaved = listener
}

/** 저장한 파일이 GitHub 사본이면 사이드바에 변경 표시를 새로 고치라고 알린다 */
export function onGithubNoteSaved(filePath: string): void {
  const parts = relative(getRootDir(), filePath).split(sep)
  if (parts.length >= 3 && parts[0] === CACHE_DIR) emitSaved()
}
