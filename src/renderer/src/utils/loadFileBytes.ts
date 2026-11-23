import { snoteUrl } from './snoteUrl'

export async function loadFileBytes(filePath: string): Promise<ArrayBuffer> {
  const res = await fetch(snoteUrl(filePath))
  if (!res.ok) throw new Error(`파일을 읽지 못했습니다 (${res.status})`)
  return res.arrayBuffer()
}
