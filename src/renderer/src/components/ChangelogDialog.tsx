import { useEffect, useState } from 'react'
import { AppIcon } from './AppIcon'
import { BTN_PRIMARY, Dialog, DialogBody, DialogHeader } from './DialogParts'
import type { ChangelogItem } from '../../../preload/index.d'

interface ChangelogDialogProps {
  items: ChangelogItem[]
  onClose: () => void
}

const KIND_STYLE: Record<ChangelogItem['kind'], string> = {
  추가: 'bg-[#4cc38a]/15 text-[#7fd6a8]',
  변경: 'bg-accent/15 text-accent',
  수정: 'bg-[#f0a070]/15 text-[#f0a070]'
}

/** 업데이트 후 첫 실행 때 뜨는 변경 사항 창. 확인, Esc, 바깥 클릭으로 닫힌다 */
export function ChangelogDialog({ items, onClose }: ChangelogDialogProps): React.JSX.Element {
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.api.app.getInfo().then((info) => setVersion(info.version))
  }, [])

  return (
    <Dialog width={460} onClose={onClose}>
      <DialogHeader
        rawIcon
        icon={<AppIcon />}
        title="업데이트"
        after={
          version && (
            <span className="rounded-md bg-bg-mute px-2 py-0.5 font-mono text-[12px] text-text-secondary">
              {version}
            </span>
          )
        }
      />
      <DialogBody>
        <ul className="max-h-[50vh] divide-y divide-white/[0.05] overflow-y-auto rounded-xl bg-bg-mute">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 px-3.5 py-3">
              <span
                className={`mt-px shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${KIND_STYLE[item.kind]}`}
              >
                {item.kind}
              </span>
              <span className="text-[13.5px] leading-relaxed text-text">{item.text}</span>
            </li>
          ))}
        </ul>
      </DialogBody>
      <div className="px-7 pb-6 pt-6">
        <button type="button" onClick={onClose} className={`${BTN_PRIMARY} w-full`} autoFocus>
          확인
        </button>
      </div>
    </Dialog>
  )
}
