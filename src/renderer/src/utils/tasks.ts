const TASK_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/
const CHECKED_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[[xX]\]/
const LIST_RE = /^\s*(?:[-*+]|\d+[.)])\s/
const FENCE_RE = /^\s*(```|~~~)/

/** 앞쪽 공백의 너비. 탭은 4칸 단위로 센다 */
function indentOf(raw: string): number {
  let n = 0
  for (const ch of raw) {
    if (ch === ' ') n += 1
    else if (ch === '\t') n += 4 - (n % 4)
    else break
  }
  return n
}

function isBlank(raw: string): boolean {
  return raw.trim() === ''
}

function setChecked(lines: string[], i: number, checked: boolean): void {
  const raw = lines[i]
  const m = TASK_RE.exec(raw)
  if (!m) return
  lines[i] = m[1] + (checked ? 'x' : ' ') + raw.slice(m[0].length - 1)
}

/** `line` 아래에서 더 깊이 들여쓴 줄들 중 체크박스인 줄의 번호. 코드 블록 안의 줄은 뺀다 */
function descendantTasks(lines: string[], line: number): number[] {
  const base = indentOf(lines[line])
  const found: number[] = []
  let inFence = false
  for (let i = line + 1; i < lines.length; i++) {
    const raw = lines[i]
    if (isBlank(raw)) continue
    if (indentOf(raw) <= base) break
    if (FENCE_RE.test(raw)) {
      inFence = !inFence
      continue
    }
    if (!inFence && TASK_RE.test(raw)) found.push(i)
  }
  return found
}

/** `line`을 감싸는 목록 항목들의 줄 번호를 가까운 것부터 돌려준다 */
function ancestorItems(lines: string[], line: number): number[] {
  const found: number[] = []
  let threshold = indentOf(lines[line])
  for (let i = line - 1; i >= 0 && threshold > 0; i--) {
    const raw = lines[i]
    if (isBlank(raw)) continue
    const indent = indentOf(raw)
    if (indent >= threshold) continue
    // 목록이 아닌 줄을 만나면 거기서 목록이 끝난 것이다
    if (!LIST_RE.test(raw)) break
    found.push(i)
    threshold = indent
  }
  return found
}

/**
 * 체크박스 한 줄을 바꾸고 계층에 맞춰 나머지를 함께 바꾼다.
 *  - 상위를 체크하거나 해제하면 그 아래 하위 체크박스가 전부 따라 바뀐다
 *  - 하위가 전부 체크되면 상위가 자동으로 체크되고, 하나라도 해제되면 상위도 해제된다 (위 단계까지 이어서)
 * 체크박스가 아닌 줄이면 null.
 */
export function toggleTaskAtLine(content: string, line: number): string | null {
  const lines = content.split('\n')
  const raw = lines[line]
  if (raw === undefined) return null
  const m = TASK_RE.exec(raw)
  if (!m) return null
  const checked = m[2] === ' '

  setChecked(lines, line, checked)
  for (const child of descendantTasks(lines, line)) setChecked(lines, child, checked)

  for (const parent of ancestorItems(lines, line)) {
    if (!TASK_RE.test(lines[parent])) continue
    const children = descendantTasks(lines, parent)
    if (children.length === 0) continue
    setChecked(
      lines,
      parent,
      children.every((i) => CHECKED_RE.test(lines[i]))
    )
  }
  return lines.join('\n')
}
