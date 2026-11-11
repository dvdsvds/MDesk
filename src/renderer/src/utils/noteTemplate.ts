import { addDays, formatDate } from './dateFormat'

export interface NoteTemplate {
  id: string
  name: string
  content: string
}

/** 템플릿의 {{date}}, {{yesterday}}, {{tomorrow}}를 채우는 날짜 형식 */
export const TEMPLATE_DATE_FORMAT = 'YYYY-MM-DD'

export const DEFAULT_TEMPLATES: NoteTemplate[] = []

export interface TemplateContext {
  /** 템플릿을 넣는 날짜. 데일리 노트면 그 노트의 날짜 */
  date: Date
  title: string
  /** {{date}}, {{yesterday}}, {{tomorrow}}에 쓸 형식 */
  dateFormat: string
}

/**
 * 템플릿 안의 변수를 바꾼다.
 * {{date}} {{time}} {{title}} {{yesterday}} {{tomorrow}}, 그리고 {{date:YYYY년 M월}}처럼 형식을 직접 줄 수 있다.
 */
export function applyTemplate(text: string, ctx: TemplateContext): string {
  const now = new Date()
  return text.replace(/\{\{\s*(\w+)(?::([^}]*))?\s*\}\}/g, (whole, name: string, fmt?: string) => {
    const format = fmt?.trim() || ctx.dateFormat
    switch (name.toLowerCase()) {
      case 'date':
        return formatDate(ctx.date, format)
      case 'yesterday':
        return formatDate(addDays(ctx.date, -1), format)
      case 'tomorrow':
        return formatDate(addDays(ctx.date, 1), format)
      case 'time':
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      case 'title':
        return ctx.title
      default:
        return whole
    }
  })
}
