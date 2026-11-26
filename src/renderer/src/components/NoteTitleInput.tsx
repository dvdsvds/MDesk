import { useEffect, useRef, useState } from 'react'
import { fileNameOf, splitName } from '../utils/path'

/** 파일 이름에 쓸 수 없는 문자 */
const INVALID_CHARS = /[\\/:*?"<>|]/g

/**
 * 에디터 본문 위의 파일 제목 칸. 확장자를 뺀 파일 이름을 보여 주고, 고치면 파일 이름을 바꾼다.
 * Enter나 다른 곳을 누르면 바꾸고, Esc면 되돌린다. 파일 이름에 쓸 수 없는 문자는 빼고 바꾼다
 */
export function NoteTitleInput({
  filePath,
  label,
  readOnly,
  onRenamed,
  onError
}: {
  /** 저장된 파일 경로. 없으면(새 탭) 이름을 바꿀 수 없다 */
  filePath: string | null
  /** 파일 경로가 없을 때 보여 줄 이름 */
  label: string
  /** Drive 임시 복사본처럼 여기서 이름을 바꾸면 안 되는 파일 */
  readOnly?: boolean
  onRenamed: (oldPath: string, newPath: string) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const base = filePath ? splitName(fileNameOf(filePath)).base : label
  const [value, setValue] = useState(base)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipCommitRef = useRef(false)

  useEffect(() => setValue(base), [base])

  const commit = async (): Promise<void> => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false
      return
    }
    if (!filePath || readOnly) return
    const next = value.replace(INVALID_CHARS, '').trim()
    if (!next || next === base) {
      setValue(base)
      return
    }
    const { ext } = splitName(fileNameOf(filePath))
    try {
      const newPath = await window.api.workspace.renameEntry(filePath, next + ext)
      onRenamed(filePath, newPath)
    } catch {
      setValue(base)
      onError('이름을 바꿀 수 없습니다. 같은 이름의 파일이 있는지 확인해 주십시오.')
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      readOnly={!filePath || readOnly}
      aria-label="파일 제목"
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter') {
          e.preventDefault()
          inputRef.current?.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          skipCommitRef.current = true
          setValue(base)
          inputRef.current?.blur()
        }
      }}
      className="w-full min-w-0 border-0 bg-transparent p-0 text-[28px] font-bold tracking-[-0.02em] text-text outline-none"
    />
  )
}
