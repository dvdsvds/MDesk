import { useEffect, type RefObject } from 'react'
import {
  githubProxyUrls,
  githubRawInfo,
  remoteImageSrc,
  resolveRepoImage
} from '../github/githubImages'

/** 이미지 자리에 안내 글 표시 */
function markMissing(img: HTMLImageElement, text: string): void {
  const box = document.createElement('span')
  box.className = 'gh-image-missing'
  box.textContent = img.alt ? `${text} (${img.alt})` : text
  img.replaceWith(box)
}

/** 이미지 주소를 넣고 실패하면 안내 글로 바꾸기 */
function show(img: HTMLImageElement, url: string): void {
  img.addEventListener('error', () => markMissing(img, '이미지를 불러오지 못했습니다.'), {
    once: true
  })
  img.src = remoteImageSrc(url)
}

/** GitHub 파일 미리보기의 이미지를 저장소 원본과 GitHub 프록시로 표시 */
export function useGithubImages(
  containerRef: RefObject<HTMLDivElement | null>,
  html: string,
  githubFile: string | null | undefined
): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el || !githubFile) return
    let cancelled = false
    const local = Array.from(el.querySelectorAll<HTMLImageElement>('img[data-gh-rel]'))
    const remote = Array.from(el.querySelectorAll<HTMLImageElement>('img[data-gh-remote]'))
    if (local.length) {
      void githubRawInfo(githubFile).then((info) => {
        if (cancelled) return
        for (const img of local) {
          const url = info && resolveRepoImage(info.rawBase, info.path, img.dataset.ghRel ?? '')
          if (url) show(img, url)
          else markMissing(img, '이미지를 찾을 수 없습니다.')
        }
      })
    }
    if (remote.length) {
      const urls = remote.map((img) => img.dataset.ghRemote ?? '')
      void githubProxyUrls(urls).then(({ urls: map, notConnected }) => {
        if (cancelled) return
        remote.forEach((img, i) => {
          const proxy = map.get(urls[i])
          if (proxy) show(img, proxy)
          else
            markMissing(
              img,
              notConnected
                ? 'GitHub에 로그인하면 외부 이미지를 표시합니다.'
                : '외부 이미지를 불러오지 못했습니다.'
            )
        })
      })
    }
    return () => {
      cancelled = true
    }
  }, [containerRef, html, githubFile])
}
