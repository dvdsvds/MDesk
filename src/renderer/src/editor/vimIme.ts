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

export function vimImeGuard(): Extension {
  return [
    EditorView.domEventHandlers({
      keydown: (e, view) => {
        const vs = getCM(view)?.state.vim
        // 한/영 키와 Shift·Ctrl 같은 조합키는 글자 입력이 아니다. 이것들을 한글 입력으로 보고 막으면
        // 영어로 바꾼 직후 칠 명령이 한동안 먹히지 않는다
        if (IME_TOGGLE.has(e.code) || IME_TOGGLE.has(e.key) || MODIFIER_KEYS.has(e.key)) {
          imeGuardUntil = 0
          return false
        }
        // 한글 조합이 아닌 일반 키(영어로 바뀐 뒤의 명령)가 오면 막던 시간을 바로 푼다
        if (!e.isComposing && e.key !== 'Process') imeGuardUntil = 0
        if (vs && !vs.insertMode && (e.key === 'Process' || e.isComposing)) {
          const saved = view.state.selection
          imeGuardUntil = Date.now() + 200
          setTimeout(() => {
            if (view.state.selection.eq(saved)) {
              view.dispatch({ selection: saved, annotations: imeRestore.of(true) })
            }
          }, 120)
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
