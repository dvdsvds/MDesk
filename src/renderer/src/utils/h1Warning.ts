export function hasExtraH1(content: string): boolean {
  const lines = content.split('\n')
  let inFence = false
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (/^#(?!#)\s/.test(line)) return true
  }
  return false
}
