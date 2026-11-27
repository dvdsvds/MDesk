export interface ExternalImage {
  from: number
  to: number
  url: string
  width: number | null
}

const EMBED_RE = /!\[\[(https?:\/\/[^\]|\n]+?)\s*(\|[^\]\n]*)?\]\]/gi
const MD_RE = /!\[[^\]\n]*\]\(\s*<?(https?:\/\/[^)\s>]+)>?(?:\s+"[^"\n]*")?\s*\)/gi
const COMPLETE_URL_RE = /^https?:\/\/[^/\s?#]+\.[^/\s?#]+/i

/** 한 줄에 있는 외부 이미지 문법 전부 */
export function findExternalImages(line: string, offset = 0): ExternalImage[] {
  const out: ExternalImage[] = []
  for (const m of line.matchAll(EMBED_RE)) {
    const w = /^\|\s*(\d+)/.exec(m[2] ?? '')
    out.push({
      from: offset + m.index,
      to: offset + m.index + m[0].length,
      url: m[1].trim(),
      width: w ? Number(w[1]) : null
    })
  }
  for (const m of line.matchAll(MD_RE)) {
    out.push({ from: offset + m.index, to: offset + m.index + m[0].length, url: m[1], width: null })
  }
  return out.sort((a, b) => a.from - b.from)
}

/** 주소가 끝까지 입력된 모양인지 판정 */
export function isCompleteUrl(url: string): boolean {
  return COMPLETE_URL_RE.test(url)
}

/** 문서에서 그 주소를 쓰는 이미지 문법의 주소를 로컬 경로로 바꾸는 변경 목록 */
export function urlReplacements(
  doc: string,
  url: string,
  relPath: string
): { from: number; to: number; insert: string }[] {
  const changes: { from: number; to: number; insert: string }[] = []
  const mdPath = /[\s()<>]/.test(relPath) ? `<${relPath}>` : relPath
  for (const m of doc.matchAll(EMBED_RE)) {
    if (m[1].trim() !== url) continue
    const start = m.index + 3 + m[1].indexOf(url)
    changes.push({ from: start, to: start + url.length, insert: relPath })
  }
  for (const m of doc.matchAll(MD_RE)) {
    if (m[1] !== url) continue
    const inner = m[0].indexOf('(')
    const urlAt = m[0].indexOf(url, inner)
    const hasAngle = m[0][urlAt - 1] === '<' && m[0][urlAt + url.length] === '>'
    const start = m.index + urlAt - (hasAngle ? 1 : 0)
    changes.push({ from: start, to: start + url.length + (hasAngle ? 2 : 0), insert: mdPath })
  }
  return changes.sort((a, b) => a.from - b.from)
}
