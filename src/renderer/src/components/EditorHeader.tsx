/**
 * 에디터 카드 머리 줄(32px). 왼쪽은 탭 줄, 오른쪽 끝은 노트 상태 등.
 * 탭이 많아도 오른쪽(상태 칸)은 침범하지 않고 탭 줄만 줄어든다
 */
export function EditorHeader({
  children,
  right
}: {
  children?: React.ReactNode
  right?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border pr-2">
      <div className="flex h-full min-w-0 flex-1 items-stretch">{children}</div>
      {right}
    </div>
  )
}
