import { mdToolbarKeys, mdToolbarPanel } from './editorToolbar'
import { slashMenu } from './slashMenu'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Annotation, Compartment, EditorState, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap, drawSelection, tooltips, } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo
} from '@codemirror/commands'
import { deleteMarkupBackward, markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { continueListMarkup } from './listEnter'
import { languages } from '@codemirror/language-data'
import { LanguageDescription } from '@codemirror/language'
import { isMarkdownPath } from '../utils/fileKind'
import { fileNameOf } from '../utils/path'
import { csvColumns, delimitedHint, detectDelimiter } from './csvColumns'
import { calloutCompletionSource, calloutMarkerColors } from './calloutEditor'
import { search, searchKeymap } from '@codemirror/search'
import { createFindPanel } from './findPanel'
import { vim, Vim } from '@replit/codemirror-vim'
import { wikilinkCompletionSource } from './wikilinkCompletion'
import { editingAssist } from './editingAssist'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { blockIndent } from './blockIndent'
import { colorSwatch } from './colorSwatch'
import { mathPreview } from './mathPreview'
import type { NoteRef } from '../utils/noteIndex'
import { codeBlocks } from './codeBlocks'
import { templateCompletion, templateCompletionSource } from '../features/template/editor/templateCompletion'
import { selectionPerLine } from './selectionPerLine'
import { getCurrentView, setCurrentView } from './currentView'
import { changeGutter } from './changeGutter'
import { foldChevronGutter } from './foldGutter'
import { markdownStyle, refreshDecorations } from './markdownStyle'
import { listRenumber } from './listRenumber'
import { cursorMetrics } from './cursorMetrics'
import { gutterAlign } from './gutterAlign'
import { koreanPhrases } from './findPhrases'
import { vimImeGuard } from './vimIme'
import { vimPointer } from './vimPointer'
import { vimModeTracker } from './vimMode'
import { pasteDrop } from './pasteDrop'
import { remoteImageDetect } from './remoteImageDetect'
import { imagePreview } from './imagePreview'
import { cursorReport, type CursorPosition } from './cursorReport'
import { markdownColors } from './markdownColors'
import { editorTheme } from './editorTheme'
import { listTabSpace } from './listTab'
import { tableEdit } from './tableEdit'
import { fullLineSelection } from './fullLineSelection'

const externalSync = Annotation.define<boolean>()

export interface MarkdownEditorHandle {
  focus: () => void
  scrollToLine: (line: number) => void
  scrollToRatio: (ratio: number) => void
}

interface MarkdownEditorProps {
  tabId: string
  filePath: string | null
  value: string
  onChange: (tabId: string, value: string) => void
  getNoteIndex: () => NoteRef[]
  getAttachmentDir: () => string
  vimMode: boolean
  baseContent: string
  onOpenBaseDiff?: () => void
  onSave?: () => void
  onCursorChange?: (pos: CursorPosition) => void
  onScrollRatio?: (ratio: number) => void
  onVimModeChange?: (mode: string) => void
  className?: string
}

const vimCompartment = new Compartment()
const toolbarCompartment = new Compartment()
const languageCompartment = new Compartment()
const imageCompartment = new Compartment()

export function undoEditor(): void {
  const view = getCurrentView()
  if (view) undo(view)
}

export function redoEditor(): void {
  const view = getCurrentView()
  if (view) redo(view)
}

export function selectEditorLines(fromLine: number, toLine: number): void {
  const view = getCurrentView()
  if (!view) return
  const doc = view.state.doc
  const a = Math.min(Math.max(1, fromLine), doc.lines)
  const b = Math.min(Math.max(a, toLine), doc.lines)
  view.dispatch({
    selection: { anchor: doc.line(a).from, head: doc.line(b).to },
    effects: EditorView.scrollIntoView(doc.line(a).from, { y: 'nearest' })
  })
}

function buildExtensions(
  getNoteIndex: () => NoteRef[],
  getAttachmentDir: () => string,
  vimModeInitial: boolean,
  reportCursor: (pos: CursorPosition) => void,
  reportVimMode: (mode: string) => void,
  baseContent: string,
  onChangeClick: () => void
): Extension[] {
  const markdownLang = markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false })
  const markdownKeys = Prec.high(
    keymap.of([
      { key: 'Enter', run: continueListMarkup },
      { key: 'Backspace', run: deleteMarkupBackward }
    ])
  )
  return [
    cursorMetrics(),
    gutterAlign(),
    koreanPhrases,
    vimCompartment.of(vimModeInitial ? [vim()] : []),
    changeGutter(baseContent, onChangeClick),
    search({ top: true, createPanel: createFindPanel }),
    basicSetup,
    foldChevronGutter(),
    drawSelection({ cursorBlinkRate: 0 }),
    fullLineSelection,
    history(),
    blockIndent,
    colorSwatch,
    mathPreview,
    tooltips({ position: 'fixed', parent: document.body }),
    templateCompletion,
    codeBlocks,
    selectionPerLine,
    listTabSpace,
    tableEdit,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    markdownLang,
    markdownKeys,
    markdownColors,
    markdownStyle,
    calloutMarkerColors,
    mdToolbarKeys,
    toolbarCompartment.of(useSettingsStore.getState().showToolbar ? mdToolbarPanel : []),
    slashMenu,
    vimImeGuard(),
    markdownLang.language.data.of({ autocomplete: wikilinkCompletionSource(getNoteIndex) }),
    markdownLang.language.data.of({ autocomplete: templateCompletionSource }),
    markdownLang.language.data.of({ autocomplete: calloutCompletionSource }),
    editingAssist(),
    listRenumber(),
    vimPointer(),
    pasteDrop(getAttachmentDir),
    remoteImageDetect(getAttachmentDir),
    imageCompartment.of(
      useSettingsStore.getState().showEditorImages ? imagePreview(getAttachmentDir) : []
    ),
    EditorView.lineWrapping,
    vimModeTracker(reportVimMode),
    cursorReport(reportCursor),
    editorTheme
  ]
}

/** 마크다운이 아닌 파일(코드, 설정, 일반 텍스트)용. 문법 색상은 확장자로 골라 나중에 불러온다. */
function buildCodeExtensions(
  vimModeInitial: boolean,
  reportCursor: (pos: CursorPosition) => void,
  reportVimMode: (mode: string) => void,
  baseContent: string,
  onChangeClick: () => void,
  wrap: boolean
): Extension[] {
  return [
    cursorMetrics(),
    gutterAlign(),
    koreanPhrases,
    vimCompartment.of(vimModeInitial ? [vim()] : []),
    changeGutter(baseContent, onChangeClick),
    search({ top: true, createPanel: createFindPanel }),
    basicSetup,
    foldChevronGutter(),
    drawSelection({ cursorBlinkRate: 0 }),
    fullLineSelection,
    history(),
    tooltips({ position: 'fixed', parent: document.body }),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    languageCompartment.of([]),
    vimImeGuard(),
    vimPointer(),
    wrap ? EditorView.lineWrapping : [],
    vimModeTracker(reportVimMode),
    cursorReport(reportCursor),
    editorTheme
  ]
}

/** 파일을 열거나 탭을 바꾸면 커서가 보이도록 에디터에 포커스를 준다. 검색창 같은 입력칸에 쓰는 중이면 건드리지 않는다 */
function focusEditor(view: EditorView): void {
  requestAnimationFrame(() => {
    const active = document.activeElement
    if (active && !view.dom.contains(active) && active.matches('input, textarea, select, [contenteditable="true"]'))
      return
    view.focus()
  })
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      tabId,
      filePath,
      value,
      onChange,
      getNoteIndex,
      getAttachmentDir,
      vimMode,
      baseContent,
      onOpenBaseDiff,
      onSave,
      onCursorChange,
      onScrollRatio,
      onVimModeChange,
      className
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const statesRef = useRef<Map<string, EditorState>>(new Map())
    const currentTabIdRef = useRef<string>(tabId)
    const filePathRef = useRef<string | null>(filePath)
    const onChangeRef = useRef(onChange)
    const getNoteIndexRef = useRef(getNoteIndex)
    const getAttachmentDirRef = useRef(getAttachmentDir)
    const vimModeRef = useRef(vimMode)
    const baseContentRef = useRef(baseContent)
    const onOpenBaseDiffRef = useRef(onOpenBaseDiff)
    const onSaveRef = useRef(onSave)
    const onCursorChangeRef = useRef(onCursorChange)
    const onScrollRatioRef = useRef(onScrollRatio)
    const onVimModeChangeRef = useRef(onVimModeChange)
    useEffect(() => {
      onChangeRef.current = onChange
      getNoteIndexRef.current = getNoteIndex
      getAttachmentDirRef.current = getAttachmentDir
      onCursorChangeRef.current = onCursorChange
      onScrollRatioRef.current = onScrollRatio
      onVimModeChangeRef.current = onVimModeChange
      baseContentRef.current = baseContent
      onOpenBaseDiffRef.current = onOpenBaseDiff
      onSaveRef.current = onSave
    })

    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      scrollToLine: (lineNumber: number) => {
        const view = viewRef.current
        if (!view) return
        const clamped = Math.min(Math.max(1, lineNumber), view.state.doc.lines)
        const line = view.state.doc.line(clamped)
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 40 })
        })
        view.focus()
      },
      scrollToRatio: (ratio: number) => {
        const view = viewRef.current
        if (!view) return
        const scroller = view.scrollDOM
        scroller.scrollTop = ratio * (scroller.scrollHeight - scroller.clientHeight)
      }
    }))

    function loadLanguage(stateTabId: string, desc: LanguageDescription): void {
      void desc.load().then((support) => {
        const effect = languageCompartment.reconfigure(support)
        if (currentTabIdRef.current === stateTabId && viewRef.current) {
          viewRef.current.dispatch({ effects: effect })
          return
        }
        const state = statesRef.current.get(stateTabId)
        if (state) statesRef.current.set(stateTabId, state.update({ effects: effect }).state)
      })
    }

    function makeState(doc: string): EditorState {
      const updateListener = EditorView.updateListener.of((update) => {
        statesRef.current.set(currentTabIdRef.current, update.state)
        if (update.docChanged && !update.transactions.some((tr) => tr.annotation(externalSync))) {
          onChangeRef.current(currentTabIdRef.current, update.state.doc.toString())
        }
      })
      const path = filePathRef.current
      if (path && !isMarkdownPath(path)) {
        const hint = delimitedHint(path)
        const desc = hint ? null : LanguageDescription.matchFilename(languages, fileNameOf(path))
        if (desc) loadLanguage(currentTabIdRef.current, desc)
        const csv = hint
          ? csvColumns({ delimiter: detectDelimiter(doc, hint), header: true })
          : desc
            ? []
            : csvColumns({ delimiter: null, header: true })
        return EditorState.create({
          doc,
          extensions: [
            ...buildCodeExtensions(
              vimModeRef.current,
              (pos) => onCursorChangeRef.current?.(pos),
              (mode) => onVimModeChangeRef.current?.(mode),
              baseContentRef.current,
              () => onOpenBaseDiffRef.current?.(),
              !desc
            ),
            csv,
            updateListener
          ]
        })
      }
      return EditorState.create({
        doc,
        extensions: [
          ...buildExtensions(
            () => getNoteIndexRef.current(),
            () => getAttachmentDirRef.current(),
            vimModeRef.current,
            (pos) => onCursorChangeRef.current?.(pos),
            (mode) => onVimModeChangeRef.current?.(mode),
            baseContentRef.current,
            () => onOpenBaseDiffRef.current?.()
          ),
          updateListener
        ]
      })
    }

    const editorFontSize = useSettingsStore((s) => s.editorFontSize)
    const editorLineHeight = useSettingsStore((s) => s.editorLineHeight)
    const editorFontFamily = useSettingsStore((s) => s.editorFontFamily)
    useEffect(() => {
      const id = requestAnimationFrame(() => {
        const view = viewRef.current
        if (!view) return
        const state = (view as unknown as { viewState?: { mustMeasureContent?: boolean } }).viewState
        if (state) state.mustMeasureContent = true
        view.requestMeasure()
        view.dispatch({ annotations: refreshDecorations.of(true) })
      })
      return () => cancelAnimationFrame(id)
    }, [editorFontSize, editorLineHeight, editorFontFamily])

    const showToolbar = useSettingsStore((s) => s.showToolbar)
    useEffect(() => {
      const effect = toolbarCompartment.reconfigure(showToolbar ? mdToolbarPanel : [])
      for (const [id, state] of statesRef.current) {
        if (id === currentTabIdRef.current) continue
        statesRef.current.set(id, state.update({ effects: effect }).state)
      }
      viewRef.current?.dispatch({ effects: effect })
    }, [showToolbar])

    const showEditorImages = useSettingsStore((s) => s.showEditorImages)
    useEffect(() => {
      const effect = imageCompartment.reconfigure(
        showEditorImages ? imagePreview(() => getAttachmentDirRef.current()) : []
      )
      for (const [id, state] of statesRef.current) {
        if (id === currentTabIdRef.current) continue
        statesRef.current.set(id, state.update({ effects: effect }).state)
      }
      viewRef.current?.dispatch({ effects: effect })
    }, [showEditorImages])

    useEffect(() => {
      vimModeRef.current = vimMode
      const effect = vimCompartment.reconfigure(vimMode ? [vim()] : [])
      for (const [id, state] of statesRef.current) {
        if (id === currentTabIdRef.current) continue
        statesRef.current.set(id, state.update({ effects: effect }).state)
      }
      viewRef.current?.dispatch({ effects: effect })
    }, [vimMode])

    useEffect(() => {
      if (!containerRef.current) return

      const initialState = makeState(value)
      statesRef.current.set(tabId, initialState)

      const view = new EditorView({ state: initialState, parent: containerRef.current })
      viewRef.current = view
      setCurrentView(view)
      focusEditor(view)
      Vim.defineEx('write', 'w', () => onSaveRef.current?.())

      const handleScroll = (): void => {
        const scroller = view.scrollDOM
        const max = scroller.scrollHeight - scroller.clientHeight
        onScrollRatioRef.current?.(max > 0 ? scroller.scrollTop / max : 0)
      }
      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

      return (): void => {
        view.scrollDOM.removeEventListener('scroll', handleScroll)
        setCurrentView(null)
        view.destroy()
      }
    }, [])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      currentTabIdRef.current = tabId
      filePathRef.current = filePath

      let state = statesRef.current.get(tabId)
      if (!state || state.doc.toString() !== value) {
        state = makeState(value)
        statesRef.current.set(tabId, state)
      }
      view.setState(state)
      focusEditor(view)
    }, [tabId])

    useEffect(() => {
      const view = viewRef.current
      if (!view || currentTabIdRef.current !== tabId) return
      const current = view.state.doc.toString()
      if (current !== value) {
        let start = 0
        const minLen = Math.min(current.length, value.length)
        while (start < minLen && current.charCodeAt(start) === value.charCodeAt(start)) start++
        let endCur = current.length
        let endNew = value.length
        while (
          endCur > start &&
          endNew > start &&
          current.charCodeAt(endCur - 1) === value.charCodeAt(endNew - 1)
        ) {
          endCur--
          endNew--
        }
        view.dispatch({
          changes: { from: start, to: endCur, insert: value.slice(start, endNew) },
          annotations: externalSync.of(true)
        })
      }
    }, [value])

    return <div ref={containerRef} className={className} />
  }
)
