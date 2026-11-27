import { useEffect, useState } from 'react'
import {
  CancelButton,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  MainButton
} from '../../components/DialogParts'
import { GithubMark } from '../../components/GithubMark'

interface Repo {
  owner: string
  repo: string
}

const nameOf = (r: Repo): string => `${r.owner}/${r.repo}`

/** 저장소 추가 창: 공개 저장소를 골라 그 안의 md 파일을 모두 가져온다 */
export function GithubPickDialog({
  linked,
  onDone,
  onCancel
}: {
  linked: Repo[]
  onDone: () => void
  onCancel: () => void
}): React.JSX.Element {
  const [repos, setRepos] = useState<Repo[] | null>(null)
  const [chosen, setChosen] = useState<Repo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.github.listRepos().then((result) => {
      if (result.ok) setRepos(result.repos)
      else setError(result.error)
    })
  }, [])

  const save = async (): Promise<void> => {
    if (!chosen) return
    setBusy(true)
    setError(null)
    const browse = await window.api.github.browse(nameOf(chosen))
    if (!browse.ok) {
      setBusy(false)
      setError(browse.error)
      return
    }
    if (browse.files.length === 0) {
      setBusy(false)
      setError('md 파일 없음')
      return
    }
    const added = await window.api.github.addLink({
      owner: browse.owner,
      repo: browse.repo,
      branch: browse.branch,
      dir: '',
      files: browse.files
    })
    setBusy(false)
    if (added.ok) onDone()
    else setError(added.error)
  }

  return (
    <Dialog width={480} onClose={onCancel}>
      <DialogHeader icon={<GithubMark size={19} />} title="저장소 추가" />
      <DialogBody>
        <div className="max-h-[240px] overflow-auto rounded-[10px] bg-bg-mute/60 p-1.5">
          {!repos ? (
            <div className="px-2 py-1.5 text-[12.5px] text-text-tertiary">
              {error ? '' : '불러오는 중…'}
            </div>
          ) : repos.length === 0 ? (
            <div className="px-2 py-1.5 text-[12.5px] text-text-tertiary">공개 저장소 없음</div>
          ) : (
            repos.map((r) => {
              const isLinked = linked.some((l) => l.owner === r.owner && l.repo === r.repo)
              const isChosen = chosen?.owner === r.owner && chosen?.repo === r.repo
              return (
                <button
                  key={nameOf(r)}
                  type="button"
                  disabled={isLinked || busy}
                  aria-pressed={isChosen}
                  onClick={() => setChosen(r)}
                  className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none disabled:opacity-40 ${
                    isChosen
                      ? 'bg-accent-soft font-medium text-accent'
                      : 'text-text hover:bg-bg-mute disabled:hover:bg-transparent'
                  }`}
                >
                  <span className="truncate">{nameOf(r)}</span>
                  {isLinked && (
                    <span className="ml-auto shrink-0 text-[11.5px] text-text-tertiary">
                      추가됨
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
        {error && <p className="text-[12.5px] text-danger">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <CancelButton onClick={onCancel} />
        <MainButton disabled={busy || !chosen} onClick={() => void save()}>
          {busy ? '가져오는 중…' : '가져오기'}
        </MainButton>
      </DialogFooter>
    </Dialog>
  )
}
