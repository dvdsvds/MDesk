import { EditorView } from '@codemirror/view'

export const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: 'var(--editor-font-size)' },
  '.cm-content': {
    fontFamily: 'var(--font-editor)',
    fontWeight: '300',
    lineHeight: 'var(--editor-line-height)',
    caretColor: 'var(--color-accent)',
    paddingTop: '0px',
    paddingBottom: '0px'
  },
  '.cm-cursor, .cm-cursor-primary': {
    borderLeftColor: 'var(--color-text)',
    borderLeftWidth: '2px'
  },
  '&:not(.cm-focused) .cm-vimCursorLayer': {
    display: 'none !important'
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--color-text-tertiary)',
    border: 'none',
    // 줄 번호도 본문과 같은 글꼴·굵기·줄 높이를 쓴다(다르면 숫자가 놓이는 높이가 어긋난다)
    fontFamily: 'var(--font-editor)',
    fontWeight: '300',
    lineHeight: 'var(--editor-line-height)',
    fontSize: '0.9em'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    // 본문 글자와 높이를 맞추는 보정값(gutterAlign.ts가 계산)
    position: 'relative',
    top: 'var(--cm-gutter-shift, 0px)'
  },
  '&.cm-focused': { outline: 'none' }
})