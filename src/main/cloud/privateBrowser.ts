import { execFile, spawn } from 'child_process'
import { shell } from 'electron'

interface BrowserSpec {
  bins: string[]
  flag: string
}

/** 기본 브라우저의 .desktop 이름에서 시크릿 창으로 여는 방법을 고른다. */
function specFor(desktopId: string): BrowserSpec | null {
  const id = desktopId.toLowerCase()
  if (id.includes('firefox')) return { bins: ['firefox'], flag: '--private-window' }
  if (id.includes('google-chrome'))
    return { bins: ['google-chrome', 'google-chrome-stable'], flag: '--incognito' }
  if (id.includes('chromium')) return { bins: ['chromium', 'chromium-browser'], flag: '--incognito' }
  if (id.includes('brave')) return { bins: ['brave-browser', 'brave'], flag: '--incognito' }
  if (id.includes('edge'))
    return { bins: ['microsoft-edge', 'microsoft-edge-stable'], flag: '--inprivate' }
  if (id.includes('vivaldi')) return { bins: ['vivaldi', 'vivaldi-stable'], flag: '--incognito' }
  return null
}

function defaultBrowserDesktopId(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('xdg-settings', ['get', 'default-web-browser'], { timeout: 3000 }, (err, stdout) =>
      resolve(err ? null : stdout.trim() || null)
    )
  })
}

function launch(bin: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { detached: true, stdio: 'ignore' })
    child.once('error', () => resolve(false))
    child.once('spawn', () => {
      child.unref()
      resolve(true)
    })
  })
}

/** Linux에서 시크릿 창으로 연다. 기본 브라우저를 알 수 없거나 실행하지 못하면 false */
async function openPrivate(url: string): Promise<boolean> {
  const desktopId = await defaultBrowserDesktopId()
  const spec = desktopId ? specFor(desktopId) : null
  if (!spec) return false
  for (const bin of spec.bins) {
    if (await launch(bin, [spec.flag, url])) return true
  }
  return false
}

/** 로그인 주소를 브라우저로 연다. Linux에서 privateWindow가 켜져 있으면 시크릿 창을 먼저 시도한다 */
export async function openLoginUrl(url: string, privateWindow: boolean): Promise<void> {
  if (!url.startsWith('https://accounts.google.com/')) return
  if (process.platform === 'linux' && privateWindow && (await openPrivate(url))) return
  await shell.openExternal(url)
}
