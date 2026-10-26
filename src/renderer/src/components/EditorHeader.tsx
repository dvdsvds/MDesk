import { Fragment } from 'react'
import ChevronIcon from '../icons/chevron.svg?react'
import FolderSvg from '../icons/folder.svg?react'
import { sepOf } from '../utils/path'

/** 작업 폴더 기준 경로 조각. 작업 폴더 밖이거나 저장 전이면 이름 하나만 */
function pathParts(filePath: string | null, rootDir: string | null, fallback: string): string[] {
  if (!filePath) return [fallback]
  const sep = sepOf(filePath)
  const rel =
    rootDir && filePath.startsWith(rootDir + sep) ? filePath.slice(rootDir.length + 1) : filePath
  return rel.split(/[\\/]/).filter(Boolean)
}

/**
 * 에디터 카드 머리 줄(32px). 왼쪽은 경로, 오른쪽 끝은 노트 상태 등.
 * 32px 안에 20px 상태 칸·14px 아이콘이 들어가서 위아래 6px·9px로 떨어진다
 */
export function EditorHeader({
  filePath,
  rootDir,
  fallbackName,
  right
}: {
  filePath: string | null
  rootDir: string | null
  fallbackName: string
  right?: React.ReactNode
}): React.JSX.Element {
  const parts = pathParts(filePath, rootDir, fallbackName)

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border pl-3 pr-2">
      <div
        className="flex min-w-0 flex-1 items-center gap-1 text-[12px] text-text-tertiary"
        title={filePath ?? undefined}
      >
        {parts.length > 1 && (
          <FolderSvg width={14} height={14} className="shrink-0 text-[var(--icon-folder)]" />
        )}
        {parts.map((part, i) => {
          const last = i === parts.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && <ChevronIcon width={12} height={12} className="shrink-0 opacity-60" />}
              <span
                className={`truncate ${last ? 'font-medium text-text-secondary' : 'shrink-[2]'}`}
              >
                {part}
              </span>
            </Fragment>
          )
        })}
      </div>
      {right}
    </div>
  )
}
