import type MarkdownIt from 'markdown-it'

type MD = InstanceType<typeof MarkdownIt>

export const REMOTE_URL_RE = /^https?:\/\//i

/** 외부 이미지 자리에 놓는 점선 상자 */
export function remoteImageBox(
  url: string,
  width: number | null,
  esc: (s: string) => string
): string {
  const w = width ? ` data-width="${width}"` : ''
  return (
    `<span class="remote-image" data-remote-url="${esc(url)}"${w}>` +
    `<span class="remote-image-text"><span>외부 이미지는 표시하지 않습니다.</span>` +
    `<span class="remote-image-url">${esc(url)}</span></span></span>`
  )
}

/** 마크다운 이미지의 외부 주소를 점선 상자로 바꿈 */
export function remoteImagePlugin(md: MD): void {
  const fallback = md.renderer.rules.image
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const src = String(tokens[idx].attrGet('src') ?? '')
    if (REMOTE_URL_RE.test(src)) return remoteImageBox(src, null, md.utils.escapeHtml)
    return fallback
      ? fallback(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options)
  }
}
