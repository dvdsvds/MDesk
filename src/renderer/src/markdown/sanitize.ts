import DOMPurify, { type Config } from 'dompurify'

const purify = DOMPurify(window)

const CONFIG: Config = {
  ADD_TAGS: ['input'],
  ADD_ATTR: ['type', 'checked', 'disabled', 'open'],
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
  FORBID_ATTR: ['srcset', 'formaction', 'action', 'ping', 'name', 'target', 'autofocus', 'is']
}

const UNSAFE_STYLE =
  /url\s*\(|expression\s*\(|@import|javascript:|position\s*:\s*(?:fixed|sticky)|behavior\s*:|-moz-binding|\\/i

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
