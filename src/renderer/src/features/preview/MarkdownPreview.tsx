import { forwardRef, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { markdownRenderer } from '../../markdown/renderMarkdown'
import { useCodeRun } from './useCodeRun'
import { useScrollSync } from './useScrollSync'
import { useClickHandlers } from './useClickHandlers'
import { useMermaid } from './useMermaid'
import { useAccordionState } from './useAccordionState'
import { useCodeDecorations } from './useCodeDecorations'
import { useOutputBlocks } from './useOutputBlocks'
import { useTemplateRender } from '../template/preview/useTemplateRender'
import { useTemplateEdit } from '../template/preview/useTemplateEdit'
import { getLiveEdit, subscribeLiveEdit } from '../template/preview/liveEdit'
import { useEmbeds } from './useEmbeds'
import { toggleTaskAtLine } from '../../utils/tasks'

const TASK_LINE_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]/

export interface MarkdownPreviewHandle {
  scrollToRatio: (ratio: number) => void
  scrollToLine: (line: number) => void
}

interface MarkdownPreviewProps {
  source: string
  baseDir?: string
  onScrollRatio?: (ratio: number) => void
  onWikilinkClick?: (title: string, heading: string | null) => void
  onToggleTask?: (line: number) => void
  onReplaceSource?: (next: string) => void
  onMinWidthChange?: (px: number) => void
  onHasTemplateChange?: (has: boolean) => void
  className?: string
  docKey?: string
  onLinkClick?: (href: string) => void
}

export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview(
    {
      source,
      baseDir,
      onScrollRatio,
      onWikilinkClick,
      onToggleTask,
      onLinkClick,
      onReplaceSource,
      onHasTemplateChange,
      className,
      docKey
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const onReplaceSourceRef = useRef(onReplaceSource)
    const sourceRef = useRef(source)
    const editIdxRef = useRef<number | null>(null)
    const editModeRef = useRef(false)

    useEffect(() => {
      onReplaceSourceRef.current = onReplaceSource
      sourceRef.current = source
    })

    const live = useSyncExternalStore(subscribeLiveEdit, getLiveEdit)
    const shownRef = useRef(source)
    const taskSourceRef = useRef<string | null>(null)
    if (!live && source !== taskSourceRef.current) shownRef.current = source
    const shown = shownRef.current
    const html = useMemo(() => markdownRenderer.render(shown, baseDir), [shown, baseDir])
    useScrollSync(containerRef, ref, onScrollRatio)
    const handleToggleTask = useMemo(() => {
      if (!onToggleTask) return undefined
      return (line: number): void => {
        const next = toggleTaskAtLine(sourceRef.current, line)
        const el = containerRef.current
        if (next !== null && el) {
          taskSourceRef.current = next
          const lines = next.split('\n')
          el.querySelectorAll<HTMLLIElement>('li[data-line]').forEach((li) => {
            if (li.closest('.embed-body')) return
            /** 체크박스는 label 안에 있을 수 있다. 하위 목록의 것이 아니라 이 항목 자신의 것만 고른다 */
            const input = Array.from(
              li.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox')
            ).find((i) => i.closest('li') === li)
            const m = TASK_LINE_RE.exec(lines[Number(li.getAttribute('data-line'))] ?? '')
            if (input && m) input.checked = m[1] !== ' '
          })
        }
        onToggleTask(line)
      }
    }, [onToggleTask])
    useClickHandlers(containerRef, onWikilinkClick, handleToggleTask, onLinkClick)
    useEffect(() => {
      if (source !== taskSourceRef.current) taskSourceRef.current = null
    })

    const onHasTemplateChangeRef = useRef(onHasTemplateChange)

    useEffect(() => {
      onHasTemplateChangeRef.current = onHasTemplateChange
    }, [onHasTemplateChange])

    useEffect(() => {
      onHasTemplateChangeRef.current?.(html.includes('snote-template'))
    }, [html])

    useAccordionState(containerRef, html, docKey)
    useMermaid(containerRef, html)
    useEmbeds(containerRef, html, baseDir, docKey)
    useCodeDecorations(containerRef, html)
    useOutputBlocks(containerRef, html)
    useEffect(() => {
      editIdxRef.current = null
      editModeRef.current = false
      containerRef.current?.dispatchEvent(new Event('snote-editmode'))
    }, [docKey])
    useTemplateRender(containerRef, html, editIdxRef, editModeRef)
    useCodeRun(containerRef, html, baseDir, sourceRef, onReplaceSourceRef)
    useTemplateEdit(containerRef, editIdxRef, editModeRef)

    return (
      <div
        ref={containerRef}
        className={`prose-preview ${className ?? ''}`}
        style={{
          fontFamily: 'var(--font-preview)',
          fontSize: 'var(--preview-font-size)',
          lineHeight: 'var(--preview-line-height)'
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
)