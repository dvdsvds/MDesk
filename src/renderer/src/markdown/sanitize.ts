import DOMPurify, { type Config } from 'dompurify'

/**
 * 마크다운 렌더 결과를 화면에 넣기 전에 거르는 마지막 관문.
 * markdown-it은 html: false라 사용자가 직접 쓴 HTML은 이미 글자로만 나오지만, 플러그인이 내는 HTML(콜아웃·수식 등)과
 * 라이브러리 취약점에 대비해 여기서 한 번 더 막는다.
 *
 * 앱 전용 인스턴스를 따로 만든다. mermaid도 같은 DOMPurify 모듈을 쓰므로 전역 인스턴스에 훅을 달면
 * mermaid의 정제에도 영향을 주기 때문이다.
 */
const purify = DOMPurify(window)

const CONFIG: Config = {
  ADD_TAGS: ['input'],
  ADD_ATTR: ['type', 'checked', 'disabled', 'open'],
  // 입력 양식·스타일·외부 문서를 끌어오는 태그는 쓸 일이 없다 (체크박스 input만 아래 훅에서 따로 허용)
  FORBID_TAGS: [
    'form',
    'button',
    'textarea',
    'select',
    'option',
    'style',
    'link',
    'meta',
    'base',
    'iframe',
    'frame',
    'frameset',
    'object',
    'embed',
    'script',
    'dialog'
  ],
  // 전송·자동 실행·이름 덮어쓰기(DOM clobbering)에 쓰이는 속성
  FORBID_ATTR: ['srcset', 'formaction', 'action', 'ping', 'name', 'target', 'autofocus', 'is']
}

/** 수식(KaTeX)이 쓰는 style에는 필요 없는 값. 외부 주소를 부르거나 화면 전체를 덮는 스타일을 막는다 */
const UNSAFE_STYLE =
  /url\s*\(|expression\s*\(|@import|javascript:|position\s*:\s*(?:fixed|sticky)|behavior\s*:|-moz-binding|\\/i

// input은 작업 목록 체크박스만 남긴다
purify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'input') return
  const el = node as Element
  const ok =
    el.getAttribute('type') === 'checkbox' && el.classList.contains('task-list-item-checkbox')
  if (!ok) el.remove()
})

purify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'style' && UNSAFE_STYLE.test(data.attrValue)) data.keepAttr = false
})

purify.addHook('afterSanitizeAttributes', (node) => {
  if ((node as Element).tagName === 'A' && (node as Element).hasAttribute('href')) {
    ;(node as Element).setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitizeHtml(html: string): string {
  return purify.sanitize(html, CONFIG) as string
}
