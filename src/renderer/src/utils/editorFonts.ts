/**
 * 에디터 글꼴 선택지.
 * 앞의 세 글꼴은 한글이 영문 폭의 정확히 2배인 고정폭 글꼴이라 표의 열이 어긋나지 않는다.
 * 뒤에는 글꼴이 없을 때를 대비해 기존 글꼴을 이어 둔다
 */
export interface EditorFontOption {
  id: string
  /** 목록에 보이는 이름 */
  name: string
  /** CSS font-family 값. 설정에는 이 값이 저장된다 */
  family: string
}

const FALLBACK = "'Roboto Mono', Pretendard, monospace"

export const EDITOR_FONTS: EditorFontOption[] = [
  { id: 'monoplex-kr', name: 'Monoplex KR', family: `'Monoplex KR', ${FALLBACK}` },
  { id: 'd2coding', name: 'D2Coding', family: `'D2Coding', ${FALLBACK}` },
  {
    id: 'nanum-gothic-coding',
    name: '나눔고딕코딩',
    family: `'Nanum Gothic Coding', ${FALLBACK}`
  },
  { id: 'roboto-mono', name: 'Roboto Mono + Pretendard', family: FALLBACK }
]

export const DEFAULT_EDITOR_FONT_FAMILY = EDITOR_FONTS[0].family

/** 이전 버전의 기본 글꼴. 이 값 그대로 쓰던 설정은 새 기본값으로 옮긴다 */
export const PREVIOUS_EDITOR_FONT_FAMILY = FALLBACK

/** 목록에서 글꼴 생김새를 보여 줄 문장 */
export const FONT_SAMPLE = '가나다라 ABC abc 0123 {}'

export function findEditorFont(family: string): EditorFontOption | undefined {
  return EDITOR_FONTS.find((f) => f.family === family)
}
