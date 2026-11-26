/** 앱 아이콘(build/icon.svg와 같은 그림). 업데이트 창, 테마 선택 창 제목 옆에 쓴다 */
export function AppIcon({ size = 40 }: { size?: number }): React.JSX.Element {
  return (
    <svg
      role="img"
      aria-label="Mdesk"
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      className="shrink-0"
    >
      <rect width="1024" height="1024" rx="230" fill="#282828" />
      <g transform="translate(92 -8)">
        <path
          d="M240 740V300L420 480L600 300V540"
          fill="none"
          stroke="#8ec9ea"
          strokeWidth="48"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="444" y="584" width="210" height="30" rx="15" fill="#b8bb26" />
        <rect x="514" y="634" width="140" height="30" rx="15" fill="#fe8019" />
        <rect x="479" y="684" width="175" height="30" rx="15" fill="#d3869b" />
        <rect x="554" y="734" width="100" height="30" rx="15" fill="#fabd2f" />
      </g>
    </svg>
  )
}
