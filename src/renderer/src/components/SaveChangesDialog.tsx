import { FileTypeIcon } from './FileTypeIcon'
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  Dialog,
  DialogBody,
  DialogHeader,
  NameBox
} from './DialogParts'

interface SaveChangesDialogProps {
  title: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

function SaveIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 2.5h7l2 2v8a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <path d="M5.5 2.5v3h4v-3M5 13.5v-4h6v4" />
    </svg>
  )
}

/** 저장하지 않은 파일을 닫을 때 묻는 창. 버튼 셋은 같은 너비다 */
export function SaveChangesDialog({
  title,
  onSave,
  onDiscard,
  onCancel
}: SaveChangesDialogProps): React.JSX.Element {
  return (
    <Dialog width={420} onClose={onCancel}>
      <DialogHeader icon={<SaveIcon />} title="저장되지 않은 변경 사항" />
      <DialogBody>
        <NameBox>
          <FileTypeIcon name={title} kind="file" size={18} />
          <span className="min-w-0 truncate text-[13.5px] font-medium text-text">{title}</span>
        </NameBox>
      </DialogBody>
      <div className="grid grid-cols-3 gap-2 px-7 pb-6 pt-[22px]">
        <button type="button" onClick={onDiscard} className={BTN_DANGER}>
          저장 안 함
        </button>
        <button type="button" onClick={onCancel} className={BTN_SECONDARY}>
          취소
        </button>
        <button type="button" onClick={onSave} className={BTN_PRIMARY} autoFocus>
          저장
        </button>
      </div>
    </Dialog>
  )
}
