import { useEffect, useMemo, useState } from 'react'
import { markdownRenderer } from '../markdown/renderMarkdown'

interface ChangelogDialogProps {
  content: string
  onClose: () => void
}

/**
 * 업데이트 후 첫 실행 때 뜨는 변경 내용 팝업 (기획 문서 11장). 닫기
 * 버튼, Esc, 바깥 클릭 아무걸로나 닫힌다.
 */
export function ChangelogDialog({ content, onClose }: ChangelogDialogProps): React.JSX.Element {
  // 변경 내역은 마크다운이다. 미리보기와 같은 렌더러로 읽기 전용으로 그린다
  const html = useMemo(() => markdownRenderer.render(content), [content])
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.api.app.getInfo().then((info) => setVersion(info.version))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-[28rem] max-w-[90vw] flex-col rounded-xl border border-border bg-bg-elevated p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-text">
            업데이트
            {version && <span className="ml-1.5 font-normal text-text-tertiary">· {version}</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-1.5 text-text-secondary hover:bg-bg-mute hover:text-text focus:outtline-none"
          >
            ✕
          </button>
        </div>
        <div
          className="prose-preview mt-3 min-h-0 flex-1 overflow-y-auto pr-1"
          style={{ fontSize: '13px', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-text-inverted focus:outline-none"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
