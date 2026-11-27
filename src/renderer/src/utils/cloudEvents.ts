export const GOOGLE_STATUS_CHANGED = 'mdesk:google-status-changed'

/** Google Drive 로그인 상태가 바뀌었다고 다른 화면에 알린다 */
export function notifyGoogleStatusChanged(): void {
  window.dispatchEvent(new Event(GOOGLE_STATUS_CHANGED))
}

export const GITHUB_CHANGED = 'mdesk:github-changed'

/** GitHub 로그인이나 연결한 저장소가 바뀌었다고 다른 화면에 알린다 */
export function notifyGithubChanged(): void {
  window.dispatchEvent(new Event(GITHUB_CHANGED))
}
