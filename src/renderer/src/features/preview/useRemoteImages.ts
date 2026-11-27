import { useEffect, type RefObject } from 'react'
import { findExternalImages, urlReplacements } from '../remoteImage/remoteImageSyntax'
import { promptRemoteImageDownload } from '../remoteImage/openRemoteImageDialog'
import { normalizeMarkdownLink } from '../../markdown/renderMarkdown'

const GITHUB_COPY_RE = /[\\/]\.ghmd[\\/]/

/** 원문에서 화면의 주소와 같은 외부 이미지 주소 찾기 */
function sourceUrlOf(source: string, shown: string): string | null {
  for (const line of source.split('\n')) {
    for (const img of findExternalImages(line)) {
      if (img.url === shown || normalizeMarkdownLink(img.url) === shown) return img.url
    }
  }
  return null
}

/** 미리보기의 외부 이미지 상자에 폭과 내려받기 버튼 붙이기 */
export function useRemoteImages(
  containerRef: RefObject<HTMLDivElement | null>,
  html: string,
  baseDir: string | undefined,
  sourceRef: RefObject<string>,
  onReplaceSourceRef: RefObject<((next: string) => void) | undefined>
): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const canDownload = !!baseDir && !GITHUB_COPY_RE.test(baseDir + '/')
    for (const box of el.querySelectorAll<HTMLElement>('.remote-image')) {
      if (box.closest('.embed-body')) continue
      const width = Number(box.dataset.width) || null
      if (width) box.style.width = `${width}px`
      if (!canDownload || box.querySelector('button')) continue
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = '내려받기'
      button.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const url = sourceUrlOf(sourceRef.current, box.dataset.remoteUrl ?? '')
        if (!url) return
        promptRemoteImageDownload(url, width, baseDir, (relPath) => {
          const source = sourceRef.current
          let next = source
          for (const c of urlReplacements(source, url, relPath).reverse())
            next = next.slice(0, c.from) + c.insert + next.slice(c.to)
          if (next !== source) onReplaceSourceRef.current?.(next)
        })
      })
      box.append(button)
    }
  }, [containerRef, html, baseDir, sourceRef, onReplaceSourceRef])
}
