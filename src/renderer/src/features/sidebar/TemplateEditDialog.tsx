import { useState } from 'react'
import {
  CancelButton,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  MainButton
} from '../../components/DialogParts'
import RenameIcon from '../../icons/ctx-rename.svg?react'
import type { NoteTemplate } from '../../utils/noteTemplate'

const FIELD =
  'w-full rounded-lg bg-text/[0.07] px-2.5 text-[13px] text-text outline-none transition-shadow focus:ring-1 focus:ring-accent/60'

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
    <Dialog width={560} onClose={onCancel}>
      <DialogHeader
        icon={<RenameIcon width={18} height={18} />}
        title={isNew ? '새 템플릿' : '템플릿 편집'}
      />
      <DialogBody>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="템플릿 이름"
          autoFocus={isNew}
          className={`${FIELD} h-8`}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          // 창 바깥 단축키(Ctrl+S 등)가 먹지 않게 막는다
          onKeyDown={(e) => e.stopPropagation()}
          spellCheck={false}
          className={`${FIELD} mt-2.5 h-72 resize-none py-2 font-[family-name:var(--font-editor)] leading-relaxed`}
        />
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
