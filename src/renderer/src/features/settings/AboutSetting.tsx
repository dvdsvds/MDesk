import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../../preload/index.d'
import { Row } from './SettingsParts'

const VALUE = 'select-text text-[13px] text-text-secondary'

const PLATFORM_NAMES: Record<string, string> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux'
}

/** 설정 > 정보. 앱 이름과 버전, 만든 이, 라이선스, 실행 환경을 보여 준다 */
export function AboutSetting({ section }: { section: 'app' | 'env' }): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.api.app.getInfo().then(setInfo)
  }, [])

  if (section === 'app') {
    return (
      <div className="divide-y divide-border">
        <Row label="이름">
          <span className={VALUE}>Mdesk</span>
        </Row>
        <Row label="버전">
          <span className={VALUE}>{info?.version ?? ''}</span>
        </Row>
      </div>
    )
  }
  return (
    <div className="divide-y divide-border">
      <Row label="Electron">
        <span className={VALUE}>{info?.electron ?? ''}</span>
      </Row>
      <Row label="Chromium">
        <span className={VALUE}>{info?.chrome ?? ''}</span>
      </Row>
      <Row label="Node.js">
        <span className={VALUE}>{info?.node ?? ''}</span>
      </Row>
      <Row label="운영체제">
        <span className={VALUE}>
          {info ? `${PLATFORM_NAMES[info.platform] ?? info.platform} (${info.arch})` : ''}
        </span>
      </Row>
    </div>
  )
}
