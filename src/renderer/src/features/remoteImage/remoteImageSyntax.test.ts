import { describe, expect, it } from 'vitest'
import { findExternalImages, isCompleteUrl, urlReplacements } from './remoteImageSyntax'

function apply(doc: string, changes: { from: number; to: number; insert: string }[]): string {
  let out = doc
  for (const c of [...changes].reverse()) out = out.slice(0, c.from) + c.insert + out.slice(c.to)
  return out
}

describe('findExternalImages', () => {
  it('두 문법과 폭을 찾음', () => {
    const line = 'a ![[https://x.com/a.png|300]] b ![고양이](https://x.com/b.png "t") c'
    const found = findExternalImages(line, 10)
    expect(found.map((f) => [f.url, f.width])).toEqual([
      ['https://x.com/a.png', 300],
      ['https://x.com/b.png', null]
    ])
    expect(line.slice(found[0].from - 10, found[0].to - 10)).toBe('![[https://x.com/a.png|300]]')
  })

  it('로컬 경로와 일반 링크는 제외', () => {
    expect(findExternalImages('![[img/a.png]] [링크](https://x.com) ![](img/b.png)')).toEqual([])
  })
})

describe('isCompleteUrl', () => {
  it('판정', () => {
    expect(isCompleteUrl('https://')).toBe(false)
    expect(isCompleteUrl('https://exa')).toBe(false)
    expect(isCompleteUrl('https://example.com')).toBe(true)
    expect(isCompleteUrl('https://example.com/a.png')).toBe(true)
  })
})

describe('urlReplacements', () => {
  const url = 'https://x.com/a.png'

  it('같은 주소를 모두 바꾸고 폭과 설명은 유지', () => {
    const doc = `![[${url}|300]]\n![고양이](${url})\n![](<${url}>)\n[링크](${url})\n![[${url}2]]`
    expect(apply(doc, urlReplacements(doc, url, 'img/a.png'))).toBe(
      `![[img/a.png|300]]\n![고양이](img/a.png)\n![](img/a.png)\n[링크](${url})\n![[${url}2]]`
    )
  })

  it('공백이 있는 경로는 꺾쇠로 감쌈', () => {
    const doc = `![](${url}) ![[${url}]]`
    expect(apply(doc, urlReplacements(doc, url, 'img/a b.png'))).toBe(
      '![](<img/a b.png>) ![[img/a b.png]]'
    )
  })
})
