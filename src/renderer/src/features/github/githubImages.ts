/** 메인 프로세스가 대신 받아 보여 주는 이미지 주소 */
export function remoteImageSrc(url: string): string {
  return `snote://remote/?u=${encodeURIComponent(url)}`
}

/** 저장소 안 상대 경로 이미지를 원본 주소로 바꾸기. 저장소 밖을 가리키면 null */
export function resolveRepoImage(rawBase: string, filePath: string, src: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) return null
  const clean = src.replace(/[?#].*$/, '')
  if (!clean) return null
  try {
    const base = new URL(rawBase)
    const fileUrl = new URL(filePath.split('/').map(encodeURIComponent).join('/'), base)
    const resolved = clean.startsWith('/') ? new URL(clean.slice(1), base) : new URL(clean, fileUrl)
    return resolved.href.startsWith(base.href) ? resolved.href : null
  } catch {
    return null
  }
}

const rawInfoCache = new Map<string, Promise<{ rawBase: string; path: string } | null>>()

/** 로컬 사본 경로의 저장소 원본 정보(캐시) */
export function githubRawInfo(
  localPath: string
): Promise<{ rawBase: string; path: string } | null> {
  let p = rawInfoCache.get(localPath)
  if (!p) {
    p = window.api.github.rawInfo(localPath).catch(() => null)
    rawInfoCache.set(localPath, p)
  }
  return p
}

const proxyCache = new Map<string, string | null>()

/** 외부 이미지 주소의 GitHub 프록시 주소들. 로그인이 안 되어 있으면 notConnected */
export async function githubProxyUrls(
  urls: string[]
): Promise<{ urls: Map<string, string | null>; notConnected: boolean }> {
  const missing = urls.filter((u) => !proxyCache.has(u))
  let notConnected = false
  if (missing.length) {
    const res = await window.api.github.imageProxyUrls(missing).catch(() => null)
    if (res?.ok) for (const u of missing) proxyCache.set(u, res.urls[u] ?? null)
    else notConnected = !!res && !res.ok && !!res.notConnected
  }
  return { urls: new Map(urls.map((u) => [u, proxyCache.get(u) ?? null])), notConnected }
}
