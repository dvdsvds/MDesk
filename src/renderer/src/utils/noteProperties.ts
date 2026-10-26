/** 노트 속성은 상태 하나뿐이다. 값은 대기·진행·보류·완료로 고정이다 */
export type PropertyKey = 'status'
export type PropertyColor = 'gray' | 'blue' | 'green' | 'orange'
/** created: 앱이 기록한 생성 날짜(YYYY-MM-DD). 고르는 값은 아니다 */
export type NoteProps = Partial<Record<PropertyKey | 'created', string>>

export interface PropertyOption {
  label: string
  color: PropertyColor
}

export const STATUS_OPTIONS: PropertyOption[] = [
  { label: '대기', color: 'gray' },
  { label: '진행', color: 'blue' },
  { label: '보류', color: 'orange' },
  { label: '완료', color: 'green' }
]

export const PROPERTY_COLORS: Record<PropertyColor, string> = {
  gray: '#8a8a85',
  blue: '#2383e2',
  green: '#2f9e5b',
  orange: '#e07a1f'
}

/** 상태를 정하지 않은 노트는 진행으로 본다 */
export const DEFAULT_STATUS = '진행'

/** 노트의 상태 항목. 저장된 값이 없거나 고정 값에 없는 예전 값이면 기본(진행) */
export function statusOf(label: string | undefined): PropertyOption {
  return (
    STATUS_OPTIONS.find((o) => o.label === label) ??
    (STATUS_OPTIONS.find((o) => o.label === DEFAULT_STATUS) as PropertyOption)
  )
}
