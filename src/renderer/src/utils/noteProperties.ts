export type PropertyKey = 'status' | 'tags'
export type PropertyColor = 'gray' | 'blue' | 'green' | 'orange'
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

export const DEFAULT_STATUS = '진행'

/** 노트의 상태 항목. 저장된 값이 없거나 고정 값에 없는 예전 값이면 기본(진행) */
export function statusOf(label: string | undefined): PropertyOption {
  return (
    STATUS_OPTIONS.find((o) => o.label === label) ??
    (STATUS_OPTIONS.find((o) => o.label === DEFAULT_STATUS) as PropertyOption)
  )
}

/** 태그 목록은 줄바꿈으로 이어 한 값으로 저장한다 */
export function splitTags(value: string | undefined): string[] {
  return value ? value.split('\n').filter(Boolean) : []
}

export function joinTags(tags: string[]): string {
  return tags.join('\n')
}
