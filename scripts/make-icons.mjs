/* eslint-disable @typescript-eslint/explicit-function-return-type -- 타입스크립트가 아닌 단독 실행 스크립트 */
// build/icon.svg 에서 앱 아이콘(png, ico, icns)을 만든다.
// 실행: npx electron scripts/make-icons.mjs   (electron의 그리기 기능을 쓴다)
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf8')

/** @returns {Promise<Buffer>} */
async function render(win, size) {
  const html =
    '<html><body style="margin:0;background:transparent;overflow:hidden">' +
    `<div style="width:${size}px;height:${size}px">${svg.replace(/width="1024" height="1024"/, `width="${size}" height="${size}"`)}</div></body></html>`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 250))
  let img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  const s = img.getSize()
  if (s.width !== size) img = img.resize({ width: size, height: size, quality: 'best' })
  return img.toPNG()
}

/** @returns {Buffer} */
function makeIco(entries) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(entries.length, 4)
  let offset = 6 + entries.length * 16
  const dirs = []
  for (const { size, png } of entries) {
    const d = Buffer.alloc(16)
    d[0] = size >= 256 ? 0 : size
    d[1] = size >= 256 ? 0 : size
    d.writeUInt16LE(1, 4)
    d.writeUInt16LE(32, 6)
    d.writeUInt32LE(png.length, 8)
    d.writeUInt32LE(offset, 12)
    offset += png.length
    dirs.push(d)
  }
  return Buffer.concat([head, ...dirs, ...entries.map((e) => e.png)])
}

/** @returns {Buffer} */
function makeIcns(items) {
  const chunks = items.map(({ type, png }) => {
    const h = Buffer.alloc(8)
    h.write(type, 0, 'ascii')
    h.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([h, png])
  })
  const body = Buffer.concat(chunks)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

app.whenReady().then(async () => {
  app.commandLine.appendSwitch('force-device-scale-factor', '1')
  const win = new BrowserWindow({
    show: false,
    transparent: true,
    frame: false,
    width: 1024,
    height: 1024,
    useContentSize: true,
    webPreferences: { offscreen: false }
  })
  win.setContentSize(1024, 1024)
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
  const png = {}
  for (const s of sizes) png[s] = await render(win, s)

  writeFileSync(join(root, 'build', 'icon.png'), png[1024])
  writeFileSync(join(root, 'resources', 'icon.png'), png[512])
  writeFileSync(
    join(root, 'build', 'icon.ico'),
    makeIco([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, png: png[size] })))
  )
  writeFileSync(
    join(root, 'build', 'icon.icns'),
    makeIcns([
      { type: 'icp5', png: png[32] },
      { type: 'ic07', png: png[128] },
      { type: 'ic08', png: png[256] },
      { type: 'ic09', png: png[512] },
      { type: 'ic10', png: png[1024] }
    ])
  )
  console.error('아이콘을 만들었어요')
  app.quit()
})
