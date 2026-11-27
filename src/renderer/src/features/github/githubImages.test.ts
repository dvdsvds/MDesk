import { describe, expect, it } from 'vitest'
import { resolveRepoImage } from './githubImages'

const BASE = 'https://raw.githubusercontent.com/o/r/main/'

describe('resolveRepoImage', () => {
  it('파일 위치 기준으로 풀기', () => {
    expect(resolveRepoImage(BASE, 'docs/guide.md', 'img/a.png')).toBe(`${BASE}docs/img/a.png`)
    expect(resolveRepoImage(BASE, 'docs/guide.md', '../logo.png')).toBe(`${BASE}logo.png`)
    expect(resolveRepoImage(BASE, 'docs/guide.md', '/assets/a.png')).toBe(`${BASE}assets/a.png`)
    expect(resolveRepoImage(BASE, 'README.md', 'a b.png?raw=true')).toBe(`${BASE}a%20b.png`)
  })

  it('저장소 밖이나 다른 형식은 거부', () => {
    expect(resolveRepoImage(BASE, 'README.md', '../../../x/y/main/a.png')).toBeNull()
    expect(resolveRepoImage(BASE, 'README.md', 'javascript:alert(1)')).toBeNull()
    expect(resolveRepoImage(BASE, 'README.md', '//evil.com/a.png')).toBeNull()
    expect(resolveRepoImage(BASE, 'README.md', 'https://x.com/a.png')).toBeNull()
  })
})
