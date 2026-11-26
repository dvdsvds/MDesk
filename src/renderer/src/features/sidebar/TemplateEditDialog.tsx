import { useState } from 'react'
import {
  CancelButton,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  FIELD_INPUT,
  FieldLabel,
  MainButton
} from '../../components/DialogParts'
import RenameIcon from '../../icons/ctx-rename.svg?react'
import type { NoteTemplate } from '../../utils/noteTemplate'


/** 템플릿 이름과 내용을 고치는 창. 새 템플릿이면 template.id가 아직 목록에 없다. */
export function TemplateEditDialog({
  template,
  isNew,
  onSave,
  onCancel
}: {
  template: NoteTemplate
  isNew: boolean
  onSave: (template: NoteTemplate) => void
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState(template.name)
  const [content, setContent] = useState(template.content)

  return (
    <Dialog width={580} onClose={onCancel}>
      <DialogHeader
        icon={<RenameIcon width={20} height={20} />}
        title={isNew ? '새 템플릿' : '템플릿 편집'}
      />
      <DialogBody>
        <label className="flex flex-col gap-1.5">
          <FieldLabel>이름</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={isNew}
            className={FIELD_INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel>내용</FieldLabel>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            // 창 바깥 단축키(Ctrl+S 등)가 먹지 않게 막는다
            onKeyDown={(e) => e.stopPropagation()}
            spellCheck={false}
            aria-label="템플릿 내용"
            className={`${FIELD_INPUT} h-[280px] resize-none px-3.5 py-3 font-[family-name:var(--font-editor)] text-[13px] leading-[1.8]`}
          />
        </label>
      </DialogBody>
      <DialogFooter>
        <CancelButton onClick={onCancel} />
        <MainButton
          disabled={!name.trim()}
          onClick={() => onSave({ ...template, name: name.trim(), content })}
        >
          저장
        </MainButton>
      </DialogFooter>
    </Dialog>
  )
}
