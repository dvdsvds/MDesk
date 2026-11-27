import { Annotation, EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getCM } from '@replit/codemirror-vim'

let imeGuardUntil = 0
const IME_TOGGLE = new Set([
  'Lang1',
  'Lang2',
  'HangulMode',
  'HanjaMode',
  'KanaMode',
  'Convert',
  'NonConvert'
])
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])
const imeRestore = Annotation.define<boolean>()
const GUARD_MS = 80
const RESTORE_MS = 50

export function vimImeGuard(): Extension {
  return [
    EditorView.domEventHandlers({
      keydown: (e, view) => {
        const vs = getCM(view)?.state.vim
        if (IME_TOGGLE.has(e.code) || IME_TOGGLE.has(e.key) || MODIFIER_KEYS.has(e.key)) {
          imeGuardUntil = 0
          return false
        }
        if (!e.isComposing && e.key !== 'Process') imeGuardUntil = 0
        if (vs && !vs.insertMode && (e.key === 'Process' || e.isComposing)) {
          const saved = view.state.selection
          imeGuardUntil = Date.now() + GUARD_MS
          setTimeout(() => {
            if (view.state.selection.eq(saved)) {
              view.dispatch({ selection: saved, annotations: imeRestore.of(true) })
            }
          }, RESTORE_MS)
          e.preventDefault()
          return true
        }
        return false
      },
      beforeinput: (e, view) => {
        const vs = getCM(view)?.state.vim
        if (
          vs &&
          !vs.insertMode &&
          (e.inputType === 'deleteContentBackward' ||
            e.inputType === 'deleteCompositionText' ||
            e.inputType === 'insertText' ||
            e.inputType === 'insertCompositionText')
        ) {
          e.preventDefault()
          return true
        }
        return false
      }
    }),
    EditorState.transactionFilter.of((tr) =>
      (tr.docChanged || tr.selection) && Date.now() < imeGuardUntil && !tr.annotation(imeRestore)
        ? []
        : tr
    )
  ]
}
