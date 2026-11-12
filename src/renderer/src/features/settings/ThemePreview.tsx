import { useSettingsStore } from '../../stores/settingsStore'
import { useThemePreviewStore } from '../../stores/themePreviewStore'
import { findTheme } from '../../utils/themes'

const dot = 'inline-block h-2 w-2 shrink-0 rounded-[2px]'

/**
 * 설정 > 화면 > 테마 위에 따로 놓는 미리보기 카드. 색 테마 목록에 마우스를 올린 테마가 있으면
 * 그 테마를, 없으면 지금 고른 테마를 보여 준다. 앱 화면과 같은 짜임(사이드바, 탭 줄,
 * 에디터와 미리보기 나란히)에 마크다운 기호와 짧은 낱말만 넣어 색이 어디에 쓰이는지 보여 준다.
 * data-theme을 이 요소에만 붙여서 앱 전체 색은 그대로 두고 이 안쪽만 해당 테마 색으로 그린다.
 */
export function ThemePreviewCard(): React.JSX.Element {
  const theme = useSettingsStore((s) => s.theme)
  const hovered = useThemePreviewStore((s) => s.hovered)
  const shown = findTheme(hovered ?? theme)

  return (
    <div
      data-theme={shown.id}
      data-mode={shown.mode}
      aria-hidden="true"
      className="flex h-56 select-none overflow-hidden rounded-[11px] bg-bg text-[11.5px] text-text"
    >
      <div className="flex w-[22%] shrink-0 flex-col gap-0.5 border-r border-border bg-bg-soft p-2">
        <span className="flex items-center gap-1.5 rounded bg-bg-mute px-1.5 py-1">
          <i className={dot} style={{ background: 'var(--icon-md)' }} />
          노트
        </span>
        <span className="flex items-center gap-1.5 px-1.5 py-1 text-text-secondary">
          <i className={dot} style={{ background: 'var(--icon-text)' }} />
          메모
        </span>
        <span className="flex items-center gap-1.5 px-1.5 py-1 text-text-secondary">
          <i className={dot} style={{ background: 'var(--icon-csv)' }} />표
        </span>
        <span className="flex items-center gap-1.5 px-1.5 py-1 text-text-secondary">
          <i className={dot} style={{ background: 'var(--icon-pdf)' }} />
          문서
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex gap-4 border-b border-border px-3 pt-2 text-text-tertiary">
          <span className="border-b-2 border-accent pb-1.5 text-text">노트.md</span>
          <span className="pb-1.5">메모.txt</span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2">
          <div className="min-w-0 border-r border-border p-3 font-mono leading-[1.65]">
            <div style={{ color: 'var(--color-syntax-heading)' }}># 제목</div>
            <div>
              <span style={{ color: 'var(--color-syntax-mark)' }}>- [ ]</span> 할 일
            </div>
            <div>
              <span style={{ color: 'var(--color-syntax-mark)' }}>- [x]</span> 완료
            </div>
            <div>
              <span style={{ color: 'var(--color-syntax-strong)' }}>**굵게**</span>{' '}
              <span style={{ color: 'var(--color-syntax-em)' }}>*기울임*</span>
            </div>
            <div style={{ color: 'var(--color-syntax-code)' }}>`코드`</div>
            <div style={{ color: 'var(--color-syntax-fence)' }}>```js</div>
            <div>
              <span style={{ color: 'var(--code-keyword)' }}>const</span>{' '}
              <span style={{ color: 'var(--code-function)' }}>a</span> ={' '}
              <span style={{ color: 'var(--code-number)' }}>1</span>
            </div>
          </div>

          <div className="min-w-0 p-3 leading-[1.65]">
            <div className="text-[16px] font-semibold">제목</div>
            <div className="mt-1 flex items-center gap-1.5 text-text-secondary">
              <i className="h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-accent" />할 일
            </div>
            <div className="flex items-center gap-1.5 text-text-secondary">
              <i className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
              완료
            </div>
            <div className="mt-1 text-text-secondary">
              <b className="text-text">굵게</b> <i>기울임</i>{' '}
              <span
                className="rounded bg-bg-mute px-1"
                style={{ color: 'var(--color-syntax-code)' }}
              >
                코드
              </span>
            </div>
            <div className="mt-1.5 rounded-md bg-bg-soft px-2 py-1 font-mono">
              <span style={{ color: 'var(--code-keyword)' }}>const</span>{' '}
              <span style={{ color: 'var(--code-function)' }}>a</span> ={' '}
              <span style={{ color: 'var(--code-number)' }}>1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
