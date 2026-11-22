import { ipcMain } from 'electron'
import { cloudStatus, connectGoogle, disconnectGoogle } from './googleAuth'

export function registerCloudIpc(): void {
  ipcMain.handle('cloud:getStatus', () => cloudStatus())
  ipcMain.handle('cloud:connectGoogle', () => connectGoogle())
  ipcMain.handle('cloud:disconnectGoogle', () => disconnectGoogle())
}
