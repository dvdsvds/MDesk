import http from 'http'
import https from 'https'
import { BlockList, isIP, type LookupFunction } from 'net'
import { lookup as dnsLookup, type LookupAddress } from 'dns'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3

export type RemoteImageError =
  'invalid-url' | 'blocked' | 'not-image' | 'too-large' | 'timeout' | 'failed'

export type RemoteImageResult =
  { ok: true; data: Buffer; mime: string; name: string } | { ok: false; error: RemoteImageError }

export interface FetchOptions {
  isBlocked?: (address: string) => boolean
  allowAnyPort?: boolean
}

const blocked = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const)
  blocked.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
] as const)
  blocked.addSubnet(net, prefix, 'ipv6')

/** 내부망·예약 대역 IP인지 판정 */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return blocked.check(address, 'ipv4')
  if (family !== 6) return true
  const lower = address.toLowerCase()
  const mapped = /^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
  if (mapped) return blocked.check(mapped[1], 'ipv4')
  const hexMapped = /^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower)
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16)
    const lo = parseInt(hexMapped[2], 16)
    return blocked.check(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, 'ipv4')
  }
  return blocked.check(lower, 'ipv6')
}

/** 바이트 앞부분으로 이미지 형식 판정 */
export function sniffImageType(data: Buffer): string | null {
  const b = data
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 6 && /^GIF8[79]a$/.test(b.subarray(0, 6).toString('latin1'))) return 'image/gif'
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString('latin1') === 'RIFF' &&
    b.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp'
  if (
    b.length >= 12 &&
    b.subarray(4, 8).toString('latin1') === 'ftyp' &&
    /^avi[fs]$/.test(b.subarray(8, 12).toString('latin1'))
  )
    return 'image/avif'
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp'
  if (b.length >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'image/x-icon'
  const rest = b
    .subarray(0, 4096)
    .toString('utf-8')
    .replace(/^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*/i, '')
  if (/^<svg[\s>]/i.test(rest)) return 'image/svg+xml'
  return null
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/svg+xml': 'svg'
}

/** 주소 끝 이름에 실제 형식의 확장자를 붙인 파일 이름 */
export function imageFileName(url: URL, mime: string): string {
  let last = url.pathname.split('/').filter(Boolean).pop() ?? ''
  try {
    last = decodeURIComponent(last)
  } catch {}
  const base = last
    .replace(/\.[^.]*$/, '')
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, '')
    .trim()
  return `${base || '이미지'}.${EXT[mime] ?? 'png'}`
}

/** 주소가 받을 수 있는 형태인지 검사 */
export function parseImageUrl(raw: string, allowAnyPort = false): URL | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (!allowAnyPort && url.port && url.port !== '80' && url.port !== '443') return null
  return url
}

/** DNS 조회 결과에 차단 대역이 있으면 연결 거부 */
function guardedLookup(isBlocked: (a: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0)
      const list = addresses as LookupAddress[]
      if (list.length === 0 || list.some((a) => isBlocked(a.address))) {
        const e = Object.assign(new Error('blocked address'), { code: 'EBLOCKED' })
        return callback(e, '', 0)
      }
      if (options.all)
        return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list)
      callback(null, list[0].address, list[0].family)
    })
  }
}

class FetchFailure extends Error {
  constructor(readonly reason: RemoteImageError) {
    super(reason)
  }
}

/** 요청 한 번 보내고 리디렉션 주소나 본문 반환 */
function requestOnce(
  url: URL,
  isBlocked: (a: string) => boolean,
  signal: AbortSignal
): Promise<{ redirect: string } | { data: Buffer }> {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host) && isBlocked(host)) return reject(new FetchFailure('blocked'))
    const mod = url.protocol === 'https:' ? https : http
    const req = mod.get(
      url,
      {
        lookup: guardedLookup(isBlocked),
        signal,
        agent: false,
        headers: { 'User-Agent': 'Mdesk', Accept: 'image/*', 'Accept-Encoding': 'identity' }
      },
      (res) => {
        const status = res.statusCode ?? 0
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.resume()
          return resolve({ redirect: res.headers.location })
        }
        if (status < 200 || status >= 300) {
          res.resume()
          return reject(new FetchFailure('failed'))
        }
        const encoding = res.headers['content-encoding']
        if (encoding && encoding !== 'identity') {
          res.destroy()
          return reject(new FetchFailure('failed'))
        }
        if (Number(res.headers['content-length'] ?? 0) > MAX_IMAGE_BYTES) {
          res.destroy()
          return reject(new FetchFailure('too-large'))
        }
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_IMAGE_BYTES) {
            res.destroy()
            reject(new FetchFailure('too-large'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => resolve({ data: Buffer.concat(chunks) }))
        res.on('error', reject)
      }
    )
    req.on('error', (err: NodeJS.ErrnoException) =>
      reject(err.code === 'EBLOCKED' ? new FetchFailure('blocked') : err)
    )
  })
}

/** 외부 이미지를 검사하며 받기 */
export async function fetchRemoteImage(
  raw: string,
  opts: FetchOptions = {}
): Promise<RemoteImageResult> {
  const isBlocked = opts.isBlocked ?? isBlockedAddress
  let url = parseImageUrl(raw, opts.allowAnyPort)
  if (!url) return { ok: false, error: 'invalid-url' }
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)
  try {
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const res = await requestOnce(url, isBlocked, controller.signal)
      if ('data' in res) {
        const mime = sniffImageType(res.data)
        if (!mime) return { ok: false, error: 'not-image' }
        return { ok: true, data: res.data, mime, name: imageFileName(url, mime) }
      }
      const next = parseImageUrl(new URL(res.redirect, url).href, opts.allowAnyPort)
      if (!next) return { ok: false, error: 'blocked' }
      url = next
    }
    return { ok: false, error: 'failed' }
  } catch (err) {
    if (timedOut) return { ok: false, error: 'timeout' }
    if (err instanceof FetchFailure) return { ok: false, error: err.reason }
    return { ok: false, error: 'failed' }
  } finally {
    clearTimeout(timer)
  }
}

const SHOW_HOST_RE = /^[\w-]+\.githubusercontent\.com$/i
const CACHE_LIMIT = 50 * 1024 * 1024
const shownCache = new Map<string, { data: Buffer; mime: string }>()
const pendingShows = new Map<string, Promise<RemoteImageResult>>()
let cacheBytes = 0

/** 화면에 바로 표시해도 되는 GitHub 이미지 주소인지 판정 */
export function isShowableImageUrl(raw: string): boolean {
  const url = parseImageUrl(raw)
  return !!url && url.protocol === 'https:' && SHOW_HOST_RE.test(url.hostname)
}

/** 캐시에 넣고 한도를 넘으면 오래된 것부터 지우기 */
function remember(url: string, data: Buffer, mime: string): void {
  if (data.length > CACHE_LIMIT) return
  shownCache.set(url, { data, mime })
  cacheBytes += data.length
  for (const [key, value] of shownCache) {
    if (cacheBytes <= CACHE_LIMIT) break
    shownCache.delete(key)
    cacheBytes -= value.data.length
  }
}

/** snote://remote/?u= 요청에 GitHub 이미지 응답 */
export async function serveRemoteImage(requestUrl: string): Promise<Response> {
  const target = new URL(requestUrl).searchParams.get('u') ?? ''
  if (!isShowableImageUrl(target)) return new Response(null, { status: 403 })
  let hit = shownCache.get(target)
  if (hit) {
    shownCache.delete(target)
    shownCache.set(target, hit)
  } else {
    let pending = pendingShows.get(target)
    if (!pending) {
      pending = fetchRemoteImage(target).finally(() => pendingShows.delete(target))
      pendingShows.set(target, pending)
    }
    const result = await pending
    if (!result.ok) return new Response(null, { status: 404 })
    hit = { data: result.data, mime: result.mime }
    if (!shownCache.has(target)) remember(target, result.data, result.mime)
  }
  const headers: Record<string, string> = {
    'Content-Type': hit.mime,
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*'
  }
  if (hit.mime === 'image/svg+xml')
    headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'"
  return new Response(new Uint8Array(hit.data), { status: 200, headers })
}
