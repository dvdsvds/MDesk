import { addDays, formatDate } from './dateFormat'

export interface NoteTemplate {
  id: string
  name: string
  content: string
}

export const TEMPLATE_DATE_FORMAT = 'YYYY-MM-DD'

export const DEFAULT_TEMPLATES: NoteTemplate[] = []

export interface TemplateContext {
  date: Date
  title: string
  dateFormat: string
}

/** 템플릿 안의 변수를 바꾼다. */
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
