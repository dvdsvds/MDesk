import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { TreeNode } from '../main/workspace/tree'
import type { RemoteImageError } from '../main/remoteImage'

type RemoteImageFetchResult =
  | { ok: true; data: Uint8Array; mime: string; name: string }
  | { ok: false; error: RemoteImageError }

interface SaveNoteArgs {
  filePath: string | null
  content: string
}

interface SaveNoteResult {
  filePath: string | null
  renamed: boolean
}

interface Backlink {
  path: string
  count: number
}

interface BacklinkWithContext {
  path: string
  count: number
  contexts: { line: number; text: string }[]
}

interface SearchQuery {
  text: string
  folder: string | null
}

interface SearchResult {
  path: string
  title: string
  snippet: string | null
}

interface BrokenLink {
  fromPath: string
  title: string
  reason: 'missing' | 'outside'
}

interface ExportOptions {
  folderPath: string
  destDir: string
  isRoot: boolean
  representativeName: 'README' | 'index' | 'main' | null
}

interface ExportResult {
  exportedFiles: number
  images: number
  attachments: number
}

interface PdfNote {
  relPath: string
  source: string
  baseDir: string
  links: Record<string, string | null>
}

type PrepareResult =
  | { ok: true; baseDir: string; mdDir: string | null; pdfDir: string | null }
  | { ok: false; error: 'invalid' | 'exists' | 'denied' }

interface RecoverableItem {
  tmpPath: string
  targetPath: string
  tmpContent: string
  currentContent: string | null
}

interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
}

type UpdateStatus =
  | { state: 'idle' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }

interface HistoryEntry {
  id: number
  size: number
}

interface CloudStatus {
  configured: boolean
  connected: boolean
  email: string | null
}

interface DriveItem {
  id: string
  name: string
  folder: boolean
}

type DriveResult<T> = ({ ok: true } & T) | { ok: false; error: string; notConnected?: boolean }

interface DriveUploadEvent {
  path: string
  state: 'uploading' | 'done' | 'conflict' | 'error'
  message?: string
}

interface GithubStatus {
  configured: boolean
  connected: boolean
  login: string | null
  avatar: string | null
}

type GithubResult<T> = ({ ok: true } & T) | { ok: false; error: string; notConnected?: boolean }

interface GithubDeviceCode {
  userCode: string
  verificationUri: string
}

interface GithubBrowseResult {
  owner: string
  repo: string
  branch: string
  dir: string
  files: string[]
}

interface GithubAddArgs {
  owner: string
  repo: string
  branch: string
  dir: string
  files: string[]
}

interface GithubLinkView {
  id: string
  owner: string
  repo: string
  branch: string
  dir: string
  files: { path: string; localPath: string; changed: boolean }[]
}

type CloudConnectResult = { ok: true; email: string | null } | { ok: false; error: string }

const api = {
  drive: {
    list: (folderId: string | null): Promise<DriveResult<{ items: DriveItem[] }>> =>
      ipcRenderer.invoke('drive:list', folderId),
    createFolder: (
      parentId: string | null,
      name: string
    ): Promise<DriveResult<{ item: DriveItem }>> =>
      ipcRenderer.invoke('drive:createFolder', parentId, name),
    createFile: (
      parentId: string | null,
      name: string
    ): Promise<DriveResult<{ item: DriveItem; path: string }>> =>
      ipcRenderer.invoke('drive:createFile', parentId, name),
    rename: (id: string, name: string): Promise<DriveResult<object>> =>
      ipcRenderer.invoke('drive:rename', id, name),
    trash: (id: string): Promise<DriveResult<object>> => ipcRenderer.invoke('drive:trash', id),
    localPath: (id: string, name: string): Promise<string> =>
      ipcRenderer.invoke('drive:localPath', id, name),
    download: (id: string, name: string): Promise<DriveResult<{ path: string }>> =>
      ipcRenderer.invoke('drive:download', id, name),
    uploadLocal: (
      sourcePath: string,
      parentId: string | null
    ): Promise<DriveResult<{ item: DriveItem; moved: { from: string; to: string }[] }>> =>
      ipcRenderer.invoke('drive:uploadLocal', sourcePath, parentId),
    onUpload: (callback: (event: DriveUploadEvent) => void): (() => void) => {
      const listener = (_event: unknown, payload: DriveUploadEvent): void => callback(payload)
      ipcRenderer.on('drive:upload', listener)
      return () => ipcRenderer.removeListener('drive:upload', listener)
    }
  },
  github: {
    getStatus: (): Promise<GithubStatus> => ipcRenderer.invoke('github:getStatus'),
    startLogin: (): Promise<GithubResult<GithubDeviceCode>> =>
      ipcRenderer.invoke('github:startLogin'),
    finishLogin: (): Promise<GithubResult<{ login: string | null }>> =>
      ipcRenderer.invoke('github:finishLogin'),
    cancelLogin: (): Promise<void> => ipcRenderer.invoke('github:cancelLogin'),
    disconnect: (): Promise<void> => ipcRenderer.invoke('github:disconnect'),
    browse: (repo: string): Promise<GithubResult<GithubBrowseResult>> =>
      ipcRenderer.invoke('github:browse', repo),
    listLinks: (): Promise<GithubLinkView[]> => ipcRenderer.invoke('github:listLinks'),
    listRepos: (): Promise<GithubResult<{ repos: { owner: string; repo: string }[] }>> =>
      ipcRenderer.invoke('github:listRepos'),
    addLink: (args: GithubAddArgs): Promise<GithubResult<{ link: GithubLinkView }>> =>
      ipcRenderer.invoke('github:addLink', args),
    removeLink: (id: string): Promise<void> => ipcRenderer.invoke('github:removeLink', id),
    commit: (id: string, message: string): Promise<GithubResult<{ count: number }>> =>
      ipcRenderer.invoke('github:commit', id, message),
    rawInfo: (localPath: string): Promise<{ rawBase: string; path: string } | null> =>
      ipcRenderer.invoke('github:rawInfo', localPath),
    imageProxyUrls: (
      urls: string[]
    ): Promise<GithubResult<{ urls: Record<string, string | null> }>> =>
      ipcRenderer.invoke('github:imageProxyUrls', urls),
    onSaved: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on('github:saved', listener)
      return () => ipcRenderer.removeListener('github:saved', listener)
    }
  },
  cloud: {
    getStatus: (): Promise<CloudStatus> => ipcRenderer.invoke('cloud:getStatus'),
    connectGoogle: (options?: { privateWindow?: boolean }): Promise<CloudConnectResult> =>
      ipcRenderer.invoke('cloud:connectGoogle', options),
    disconnectGoogle: (): Promise<void> => ipcRenderer.invoke('cloud:disconnectGoogle')
  },
  app: {
    getChangelog: (): Promise<{ kind: '추가' | '변경' | '수정'; text: string }[] | null> =>
      ipcRenderer.invoke('app:getChangelog'),
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:getInfo')
  },
  update: {
    getStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('update:getStatus'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    onStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
      const listener = (_event: unknown, status: UpdateStatus): void => callback(status)
      ipcRenderer.on('update:status', listener)
      return () => ipcRenderer.removeListener('update:status', listener)
    }
  },
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggleMaximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    confirmClose: (): Promise<void> => ipcRenderer.invoke('window:confirmClose'),
    onCloseRequested: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on('window:close-requested', listener)
      return () => ipcRenderer.removeListener('window:close-requested', listener)
    },
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    platform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke('window:platform'),
    onMaximizedChanged: (callback: (isMaximized: boolean) => void): (() => void) => {
      const listener = (_event: unknown, isMaximized: boolean): void => callback(isMaximized)
      ipcRenderer.on('window:maximized-changed', listener)
      return () => ipcRenderer.removeListener('window:maximized-changed', listener)
    }
  },
  export: {
    pdf: (payload: {
      title: string
      html: string
      css: string
    }): Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('export:pdf', payload),
    pdfFile: (payload: {
      html: string
      css: string
      pdfDir: string
      relPath: string
    }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('export:pdfFile', payload)
  },
  props: {
    getAll: (): Promise<Record<string, Record<string, string>>> =>
      ipcRenderer.invoke('props:getAll'),
    set: (filePath: string, props: Record<string, string> | null): Promise<void> =>
      ipcRenderer.invoke('props:set', filePath, props)
  },
  remoteImage: {
    fetch: (url: string): Promise<RemoteImageFetchResult> =>
      ipcRenderer.invoke('remoteImage:fetch', url)
  },
  code: {
    readFiles: (
      code: string,
      baseDir: string,
      lang: 'js' | 'py' = 'py'
    ): Promise<{ files: Record<string, string>; fileErrors: Record<string, string> }> =>
      ipcRenderer.invoke('code:readFiles', code, baseDir, lang)
  },
  workspace: {
    getRootDir: (): Promise<string> => ipcRenderer.invoke('workspace:getRootDir'),
    getTree: (): Promise<TreeNode[]> => ipcRenderer.invoke('workspace:getTree'),
    readFile: (filePath: string): Promise<string> =>
      ipcRenderer.invoke('workspace:readFile', filePath),
    readTextFile: (
      filePath: string
    ): Promise<{ ok: true; content: string } | { ok: false; reason: 'binary' | 'tooLarge' }> =>
      ipcRenderer.invoke('workspace:readTextFile', filePath),
    saveNote: (args: SaveNoteArgs): Promise<SaveNoteResult> =>
      ipcRenderer.invoke('workspace:saveNote', args),
    createFolder: (dirPath: string, name: string): Promise<string> =>
      ipcRenderer.invoke('workspace:createFolder', dirPath, name),
    createNote: (dirPath: string, title: string): Promise<string> =>
      ipcRenderer.invoke('workspace:createNote', dirPath, title),
    renameEntry: (oldPath: string, newName: string): Promise<string> =>
      ipcRenderer.invoke('workspace:renameEntry', oldPath, newName),
    moveEntry: (sourcePath: string, targetDirPath: string): Promise<string> =>
      ipcRenderer.invoke('workspace:moveEntry', sourcePath, targetDirPath),
    trash: (targetPath: string): Promise<string> =>
      ipcRenderer.invoke('workspace:trash', targetPath),
    restoreTrash: (id: string): Promise<string> => ipcRenderer.invoke('workspace:restoreTrash', id),
    emptyTrash: (): Promise<void> => ipcRenderer.invoke('workspace:emptyTrash'),
    openTrash: (): Promise<string> => ipcRenderer.invoke('workspace:openTrash'),
    reveal: (targetPath: string): Promise<void> =>
      ipcRenderer.invoke('workspace:reveal', targetPath),
    openInDefaultApp: (targetPath: string): Promise<string> =>
      ipcRenderer.invoke('workspace:openInDefaultApp', targetPath),
    copyPath: (targetPath: string, relative: boolean): Promise<void> =>
      ipcRenderer.invoke('workspace:copyPath', targetPath, relative),
    findBacklinks: (mdPath: string): Promise<Backlink[]> =>
      ipcRenderer.invoke('workspace:findBacklinks', mdPath),
    findBacklinkContexts: (mdPath: string): Promise<BacklinkWithContext[]> =>
      ipcRenderer.invoke('workspace:findBacklinkContexts', mdPath),
    saveAttachment: (
      noteDirPath: string,
      kind: 'img' | 'files',
      fileName: string,
      data: ArrayBuffer
    ): Promise<string> =>
      ipcRenderer.invoke('workspace:saveAttachment', noteDirPath, kind, fileName, data),
    search: (query: SearchQuery): Promise<SearchResult[]> =>
      ipcRenderer.invoke('workspace:search', query),
    pickExportDestination: (): Promise<string | null> =>
      ipcRenderer.invoke('workspace:pickExportDestination'),
    hasRootMainNote: (): Promise<boolean> => ipcRenderer.invoke('workspace:hasRootMainNote'),
    checkExportLinks: (folderPath: string): Promise<BrokenLink[]> =>
      ipcRenderer.invoke('workspace:checkExportLinks', folderPath),
    exportFolder: (opts: ExportOptions): Promise<ExportResult> =>
      ipcRenderer.invoke('workspace:exportFolder', opts),
    listPdfNotes: (folderPath: string): Promise<PdfNote[]> =>
      ipcRenderer.invoke('workspace:listPdfNotes', folderPath),
    openPath: (targetPath: string): Promise<string> =>
      ipcRenderer.invoke('workspace:openPath', targetPath),
    prepareExport: (
      parentDir: string,
      name: string,
      md: boolean,
      pdf: boolean
    ): Promise<PrepareResult> =>
      ipcRenderer.invoke('workspace:prepareExport', parentDir, name, md, pdf),
    listRecoverable: (): Promise<RecoverableItem[]> =>
      ipcRenderer.invoke('workspace:listRecoverable'),
    applyRecovery: (tmpPath: string, targetPath: string): Promise<void> =>
      ipcRenderer.invoke('workspace:applyRecovery', tmpPath, targetPath),
    discardRecovery: (tmpPath: string): Promise<void> =>
      ipcRenderer.invoke('workspace:discardRecovery', tmpPath),
    listHistory: (filePath: string): Promise<HistoryEntry[]> =>
      ipcRenderer.invoke('workspace:listHistory', filePath),
    readHistory: (filePath: string, id: number): Promise<string> =>
      ipcRenderer.invoke('workspace:readHistory', filePath, id),
    getHistoryDir: (): Promise<string> => ipcRenderer.invoke('workspace:getHistoryDir'),
    pickFolder: (defaultPath?: string): Promise<string | null> =>
      ipcRenderer.invoke('workspace:pickFolder', defaultPath),
    setHistoryDir: (
      dir: string | null
    ): Promise<{ ok: true; path: string } | { ok: false; error: string }> =>
      ipcRenderer.invoke('workspace:setHistoryDir', dir),
    onTreeChanged: (callback: (tree: TreeNode[]) => void): (() => void) => {
      const listener = (_event: unknown, tree: TreeNode[]): void => callback(tree)
      ipcRenderer.on('workspace:tree-changed', listener)
      return () => ipcRenderer.removeListener('workspace:tree-changed', listener)
    },
    onFileChanged: (callback: (filePath: string) => void): (() => void) => {
      const listener = (_event: unknown, filePath: string): void => callback(filePath)
      ipcRenderer.on('workspace:file-changed', listener)
      return () => ipcRenderer.removeListener('workspace:file-changed', listener)
    },
    onExternalNameSanitized: (
      callback: (oldPath: string, newPath: string) => void
    ): (() => void) => {
      const listener = (_event: unknown, oldPath: string, newPath: string): void =>
        callback(oldPath, newPath)
      ipcRenderer.on('workspace:external-name-sanitized', listener)
      return () => ipcRenderer.removeListener('workspace:external-name-sanitized', listener)
    },
    onFileExternallyRemoved: (callback: (filePath: string) => void): (() => void) => {
      const listener = (_event: unknown, filePath: string): void => callback(filePath)
      ipcRenderer.on('workspace:file-externally-removed', listener)
      return () => ipcRenderer.removeListener('workspace:file-externally-removed', listener)
    }
  }
}

export type MdeskApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
