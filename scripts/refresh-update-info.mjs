// 서명한 Windows 설치 파일로 .blockmap과 latest.yml을 다시 만든다 (node scripts/refresh-update-info.mjs <설치 파일> [latest.yml])
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap.js')

const exePath = process.argv[2]
if (!exePath) {
  console.error('설치 파일 경로를 지정해 주십시오.')
  process.exit(1)
}
const ymlPath = process.argv[3] ?? join(dirname(exePath), 'latest.yml')
const exeName = basename(exePath)

const { size, sha512 } = await buildBlockMap(exePath, 'gzip', `${exePath}.blockmap`)

const lines = readFileSync(ymlPath, 'utf8').split(/\r?\n/)
let inEntry = false
let topLevelMatches = false
let changed = 0
const out = lines.map((line) => {
  const url = /^\s*-\s*url:\s*(.+?)\s*$/.exec(line)
  if (url) {
    inEntry = url[1] === exeName
    return line
  }
  if (/^\S/.test(line)) inEntry = false
  const path = /^path:\s*(.+?)\s*$/.exec(line)
  if (path) topLevelMatches = path[1] === exeName
  if (inEntry && /^\s+sha512:/.test(line)) {
    changed++
    return line.replace(/sha512:.*/, `sha512: ${sha512}`)
  }
  if (inEntry && /^\s+size:/.test(line)) {
    changed++
    return line.replace(/size:.*/, `size: ${size}`)
  }
  if (topLevelMatches && /^sha512:/.test(line)) {
    changed++
    return `sha512: ${sha512}`
  }
  return line
})

if (changed < 2) {
  console.error(`${ymlPath}에서 ${exeName} 항목을 찾지 못했습니다.`)
  process.exit(1)
}
writeFileSync(ymlPath, out.join('\n'))
console.log(`${exeName}: size ${size}, sha512 ${sha512}`)
