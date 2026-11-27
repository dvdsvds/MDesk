import { app, shell, BrowserWindow, protocol, net, ipcMain, session } from 'electron'
import { autoUpdater } from 'electron-updater'
import { basename, join, resolve, sep } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerWorkspaceIpc } from './workspace/ipc'
import { stopWatcher } from './workspace/watcher'
import { assertInsideRoot, getLastSeenVersion, setLastSeenVersion } from './workspace/paths'
import { readChangelogFor } from './updateInfo'
import { registerCodeRunner } from './codeRunner'
import { registerPdfExport } from './pdfExport'
import { registerCloudIpc } from './cloud/ipc'
import { pathToFileURL } from 'url'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'snote',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
  },
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

const devServerUrl = process.env['ELECTRON_RENDERER_URL']

let mainWindowRef: BrowserWindow | null = null
let closeConfirmed = true

type UpdateStatus =
  | { state: 'idle' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }

let updateStatus: UpdateStatus = { state: 'idle' }
let installOnClose = false

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000
const UPDATE_FOCUS_GAP_MS = 5 * 60 * 1000

function setUpdateStatus(next: UpdateStatus): void {
  updateStatus = next
  mainWindowRef?.webContents.send('update:status', next)
}

const gotInstanceLock = app.requestSingleInstanceLock()
if (!gotInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = mainWindowRef
    if (!win) {
      if (app.isReady()) createWindow()
      return
    }
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
}

function isAllowedNavigationTarget(url: string): boolean {
  if (is.dev && devServerUrl && url.startsWith(devServerUrl)) return true
  return url.startsWith('app://renderer/')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1316,
    height: 800,
    minWidth: 480,
    minHeight: 320,
    show: false,
    frame: false,
    roundedCorners: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: is.dev
    }
  })

  mainWindowRef = mainWindow

  closeConfirmed = false
  mainWindow.on('close', (event) => {
    if (closeConfirmed) return
    event.preventDefault()
    mainWindow.webContents.send('window:close-requested')
  })

  mainWindow.on('closed', () => {
    if (mainWindowRef === mainWindow) mainWindowRef = null
  })

  const sendMaximizedChanged = (): void => {
    mainWindow.webContents.send('window:maximized-changed', mainWindow.isMaximized())
  }
  mainWindow.on('maximize', sendMaximizedChanged)
  mainWindow.on('unmaximize', sendMaximizedChanged)

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (!/^https?:\/\//.test(details.url)) return { action: 'deny' }
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedNavigationTarget(url)) return
    event.preventDefault()
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })

  if (is.dev && devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadURL('app://renderer/index.html')
  }
}

app.whenReady().then(() => {
  if (!gotInstanceLock) return
  electronApp.setAppUserModelId('com.mdesk.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  /** 카메라·위치·알림 같은 권한은 쓰지 않으므로 모두 거절한다. 코드 복사용 클립보드 쓰기만 허용한다 */
  const allowPermission = (permission: string): boolean => permission === 'clipboard-sanitized-write'
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(allowPermission(permission))
  )
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowPermission(permission))
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })

  registerWorkspaceIpc(() => mainWindowRef)
  registerCodeRunner()
  registerPdfExport(() => mainWindowRef)
  registerCloudIpc(() => mainWindowRef)

  ipcMain.handle('window:minimize', () => mainWindowRef?.minimize())
  ipcMain.handle('window:toggleMaximize', () => {
    if (!mainWindowRef) return
    if (mainWindowRef.isMaximized()) mainWindowRef.unmaximize()
    else mainWindowRef.maximize()
  })
  ipcMain.handle('window:close', () => mainWindowRef?.close())
  ipcMain.handle('window:confirmClose', () => {
    closeConfirmed = true
    if (installOnClose) {
      autoUpdater.quitAndInstall(false, true)
      return
    }
    mainWindowRef?.close()
  })
  ipcMain.handle('window:isMaximized', () => mainWindowRef?.isMaximized() ?? false)
  ipcMain.handle('window:platform', () => process.platform)

  const currentVersion = app.getVersion()
  const lastSeenVersion = getLastSeenVersion()
  const changelogToShow = lastSeenVersion && lastSeenVersion !== currentVersion ? readChangelogFor(currentVersion) : null
  setLastSeenVersion(currentVersion)
  ipcMain.handle('app:getChangelog', () => changelogToShow)
  ipcMain.handle('app:getInfo', () => ({
    name: app.getName(),
    version: currentVersion,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch
  }))

  ipcMain.handle('update:getStatus', () => updateStatus)
  ipcMain.handle('update:install', () => {
    if (updateStatus.state !== 'ready') return
    installOnClose = true
    mainWindowRef?.close()
  })

  if (!is.dev) {
    autoUpdater.autoDownload = true
    autoUpdater.on('update-available', (info) => {
      setUpdateStatus({ state: 'downloading', version: info.version, percent: 0 })
    })
    autoUpdater.on('download-progress', (p) => {
      if (updateStatus.state !== 'downloading') return
      setUpdateStatus({ ...updateStatus, percent: Math.round(p.percent) })
    })
    autoUpdater.on('update-downloaded', (info) => {
      setUpdateStatus({ state: 'ready', version: info.version })
    })
    autoUpdater.on('error', (err) => {
      console.error('자동 업데이트 확인에 실패했습니다:', err)
      if (updateStatus.state === 'downloading') setUpdateStatus({ state: 'idle' })
    })
    let lastCheckAt = 0
    const checkForUpdate = (): void => {
      if (updateStatus.state !== 'idle') return
      lastCheckAt = Date.now()
      autoUpdater.checkForUpdates().catch(() => {})
    }
    checkForUpdate()
    app.on('browser-window-focus', () => {
      if (Date.now() - lastCheckAt >= UPDATE_FOCUS_GAP_MS) checkForUpdate()
    })
    setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
  }

  const rendererRoot = join(__dirname, '../renderer')
  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url)
      if (url.host !== 'renderer') return new Response(null, { status: 404 })
      const target = resolve(rendererRoot, '.' + decodeURIComponent(url.pathname))
      if (target !== rendererRoot && !target.startsWith(rendererRoot + sep))
        return new Response(null, { status: 403 })
      const res = await net.fetch(pathToFileURL(target).href)
      if (basename(target) !== 'js-worker.js') return res
      const headers = new Headers(res.headers)
      headers.set('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-eval'")
      return new Response(res.body, { status: res.status, headers })
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  protocol.handle('snote', async (request) => {
    try {
      let p = decodeURIComponent(new URL(request.url).pathname)
      if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1)
      const safePath = assertInsideRoot(p)
      const res = await net.fetch(pathToFileURL(safePath).href)
      const headers = new Headers(res.headers)
      headers.set('Access-Control-Allow-Origin', '*')
      return new Response(res.body, { status: res.status, headers })
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopWatcher()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
