import { ipcMain, type BrowserWindow } from 'electron'
import { cloudStatus, connectGoogle, disconnectGoogle } from './googleAuth'
import {
  createDriveFile,
  createDriveFolder,
  downloadDriveFile,
  driveLocalPath,
  listDrive,
  renameDriveItem,
  setUploadListener,
  trashDriveItem,
  uploadLocalEntry
} from './drive'

export function registerCloudIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('cloud:getStatus', () => cloudStatus())
  ipcMain.handle('cloud:connectGoogle', (_e, options?: { privateWindow?: boolean }) =>
    connectGoogle(options)
  )
  ipcMain.handle('cloud:disconnectGoogle', () => disconnectGoogle())

  setUploadListener((event) => getWindow()?.webContents.send('drive:upload', event))
  ipcMain.handle('drive:list', (_e, folderId: string | null) => listDrive(folderId))
  ipcMain.handle('drive:createFolder', (_e, parentId: string | null, name: string) =>
    createDriveFolder(parentId, name)
  )
  ipcMain.handle('drive:createFile', (_e, parentId: string | null, name: string) =>
    createDriveFile(parentId, name)
  )
  ipcMain.handle('drive:rename', (_e, id: string, name: string) => renameDriveItem(id, name))
  ipcMain.handle('drive:trash', (_e, id: string) => trashDriveItem(id))
  ipcMain.handle('drive:localPath', (_e, id: string, name: string) => driveLocalPath(id, name))
  ipcMain.handle('drive:uploadLocal', (_e, sourcePath: string, parentId: string | null) =>
    uploadLocalEntry(sourcePath, parentId)
  )
  ipcMain.handle('drive:download', (_e, id: string, name: string) => downloadDriveFile(id, name))
}
