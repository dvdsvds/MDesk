export interface EditorFontOption {
  id: string
  name: string
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

export const PREVIOUS_EDITOR_FONT_FAMILY = FALLBACK

export const FONT_SAMPLE = '가나다라 ABC abc 0123 {}'

export function findEditorFont(family: string): EditorFontOption | undefined {
  return EDITOR_FONTS.find((f) => f.family === family)
}
