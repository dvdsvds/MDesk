import { app, safeStorage, shell } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { createServer, type Server } from 'http'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
// 앱이 만든 파일만 접근하는 범위(drive.file)와, 어느 계정인지 보여 주기 위한 이메일
const SCOPES = [DRIVE_SCOPE, 'openid', 'email']
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

export interface CloudStatus {
  /** 이 빌드에 Google 클라이언트 정보가 들어 있는지 */
  configured: boolean
  connected: boolean
  email: string | null
}

export type ConnectResult = { ok: true; email: string | null } | { ok: false; error: string }

interface StoredLogin {
  refreshToken: string
  email: string | null
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  id_token?: string
  error?: string
  error_description?: string
}

let accessToken: { value: string; expiresAt: number } | null = null
let pendingServer: Server | null = null

const clientId = (): string => import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID ?? ''
const clientSecret = (): string => import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET ?? ''
const isConfigured = (): boolean => clientId() !== '' && clientSecret() !== ''

function loginFile(): string {
  return join(app.getPath('userData'), 'cloud', 'google.bin')
}

async function readLogin(): Promise<StoredLogin | null> {
  try {
    const file = loginFile()
    if (!existsSync(file) || !(await safeStorage.isAsyncEncryptionAvailable())) return null
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(readFileSync(file))
    const parsed = JSON.parse(result) as StoredLogin
    if (typeof parsed.refreshToken !== 'string') return null
    // 암호화 키가 바뀌었으면 새 키로 다시 저장한다
    if (shouldReEncrypt) await writeLogin(parsed)
    return parsed
  } catch {
    return null
  }
}

async function writeLogin(login: StoredLogin): Promise<void> {
  mkdirSync(join(app.getPath('userData'), 'cloud'), { recursive: true })
  writeFileSync(loginFile(), await safeStorage.encryptStringAsync(JSON.stringify(login)))
}

function clearLogin(): void {
  accessToken = null
  rmSync(loginFile(), { force: true })
}

const base64Url = (buf: Buffer): string => buf.toString('base64url')

function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = idToken?.split('.')[1]
    if (!payload) return null
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      email?: unknown
    }
    return typeof parsed.email === 'string' ? parsed.email : null
  } catch {
    return null
  }
}

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      ...params
    })
  })
  return (await res.json()) as TokenResponse
}

const DONE_PAGE = (title: string, body: string): string =>
  `<!doctype html><html lang="ko"><meta charset="utf-8"><title>Mdesk</title>` +
  `<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0">` +
  `<div style="text-align:center"><h2>${title}</h2><p>${body}</p></div></body></html>`

/** 브라우저에서 로그인을 마칠 때까지 기다렸다가 인증 코드를 돌려준다 */
function waitForCode(
  state: string,
  buildAuthUrl: (redirectUri: string) => string
): Promise<{ code: string; redirectUri: string }> {
  return new Promise((resolve, reject) => {
    pendingServer?.close()
    const server = createServer()
    pendingServer = server
    let settled = false
    // 서버를 닫은 뒤에는 주소를 읽을 수 없으므로, 열릴 때 한 번만 저장해 둔다.
    // 인증 요청과 토큰 교환의 redirect_uri는 글자 하나까지 같아야 한다
    let redirectUri = ''
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close()
      if (pendingServer === server) pendingServer = null
      fn()
    }
    const timer = setTimeout(
      () => finish(() => reject(new Error('로그인 시간이 지났습니다. 다시 시도해 주십시오.'))),
      LOGIN_TIMEOUT_MS
    )

    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      if (!code && !error) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' })
      if (url.searchParams.get('state') !== state) {
        res.end(DONE_PAGE('연결하지 못했습니다', '요청이 올바르지 않습니다. Mdesk에서 다시 시도해 주십시오.'))
        finish(() => reject(new Error('로그인 요청이 올바르지 않습니다. 다시 시도해 주십시오.')))
        return
      }
      if (error || !code) {
        res.end(DONE_PAGE('연결하지 못했습니다', 'Mdesk로 돌아가서 다시 시도해 주십시오.'))
        finish(() =>
          reject(new Error(error === 'access_denied' ? '로그인을 취소했습니다.' : '로그인에 실패했습니다.'))
        )
        return
      }
      res.end(DONE_PAGE('연결되었습니다', '이 창을 닫고 Mdesk로 돌아가십시오.'))
      finish(() => resolve({ code, redirectUri }))
    })

    server.on('error', () => finish(() => reject(new Error('로그인을 시작하지 못했습니다.'))))
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      redirectUri = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
      void shell.openExternal(buildAuthUrl(redirectUri))
    })
  })
}

export async function cloudStatus(): Promise<CloudStatus> {
  const login = await readLogin()
  return { configured: isConfigured(), connected: login !== null, email: login?.email ?? null }
}

async function revoke(token: string): Promise<void> {
  try {
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token })
    })
  } catch {
    // 오프라인이어도 이 기기에서의 연결 해제는 진행한다
  }
}

export async function connectGoogle(): Promise<ConnectResult> {
  if (!isConfigured()) return { ok: false, error: '이 빌드에는 Google 연결 정보가 들어 있지 않습니다.' }
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    return {
      ok: false,
      error:
        '로그인 정보를 안전하게 보관할 수 없습니다. Linux에서는 GNOME Keyring이나 KWallet 같은 비밀번호 저장소가 필요합니다.'
    }
  }
  try {
    const verifier = base64Url(randomBytes(32))
    const challenge = base64Url(createHash('sha256').update(verifier).digest())
    const state = base64Url(randomBytes(16))
    const { code, redirectUri } = await waitForCode(state, (redirect) => {
      const url = new URL(AUTH_URL)
      url.search = new URLSearchParams({
        client_id: clientId(),
        redirect_uri: redirect,
        response_type: 'code',
        scope: SCOPES.join(' '),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        access_type: 'offline',
        // 이전에 연결한 적이 있어도 refresh token을 다시 받기 위해 동의 화면을 매번 보인다
        prompt: 'consent'
      }).toString()
      return url.toString()
    })

    const token = await postToken({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri
    })
    if (!token.access_token || !token.refresh_token) {
      console.error('[cloud] 토큰 교환 실패:', token.error, token.error_description, {
        accessToken: !!token.access_token,
        refreshToken: !!token.refresh_token
      })
      return {
        ok: false,
        error: `로그인 정보를 받지 못했습니다${token.error ? ` (${token.error})` : ''}. 다시 시도해 주십시오.`
      }
    }
    // 동의 화면에서 Drive 항목을 끄면 로그인은 되지만 파일에 접근할 수 없다
    if (!token.scope?.split(' ').includes(DRIVE_SCOPE)) {
      await revoke(token.refresh_token)
      return {
        ok: false,
        error: 'Google Drive 접근을 허용해야 연결할 수 있습니다. 다시 시도해서 모든 항목을 허용해 주십시오.'
      }
    }
    const email = emailFromIdToken(token.id_token)
    await writeLogin({ refreshToken: token.refresh_token, email })
    accessToken = {
      value: token.access_token,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000
    }
    return { ok: true, email }
  } catch (e) {
    console.error('[cloud] 연결 실패:', e)
    return { ok: false, error: e instanceof Error ? e.message : '연결하지 못했습니다.' }
  }
}

export async function disconnectGoogle(): Promise<void> {
  const login = await readLogin()
  clearLogin()
  if (login) await revoke(login.refreshToken)
}

/** 접근 토큰이 서버에서 거절됐을 때 캐시를 버려 다음 호출에서 새로 받게 한다 */
export function resetGoogleAccessToken(): void {
  accessToken = null
}

/** Drive API 호출에 쓸 접근 토큰. 만료됐으면 새로 받고, 연결이 끊긴 상태면 null */
export async function getGoogleAccessToken(): Promise<string | null> {
  if (accessToken && accessToken.expiresAt - Date.now() > 60_000) return accessToken.value
  const login = await readLogin()
  if (!login) return null
  try {
    const token = await postToken({ grant_type: 'refresh_token', refresh_token: login.refreshToken })
    if (token.error === 'invalid_grant') {
      // 사용자가 Google 계정에서 연결을 끊었거나 토큰이 만료됨
      clearLogin()
      return null
    }
    if (!token.access_token) return null
    accessToken = {
      value: token.access_token,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000
    }
    return accessToken.value
  } catch {
    return null
  }
}
