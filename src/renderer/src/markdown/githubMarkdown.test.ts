// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderGithubMarkdown } from './githubMarkdown'

const render = (src: string): string => renderGithubMarkdown(src)

describe('GitHub HTML 허용', () => {
  it('모양 태그는 남김', () => {
    const html = render('<details><summary>펼치기</summary>\n\n**숨김**\n\n</details>')
    expect(html).toContain('<details>')
    expect(html).toContain('<summary>펼치기</summary>')
    expect(html).toContain('<strong>숨김</strong>')
    expect(render('<div align="center"><b>a</b></div>')).toContain(
      '<div align="center"><b>a</b></div>'
    )
    expect(render('<kbd>Ctrl</kbd>')).toContain('<kbd>Ctrl</kbd>')
  })

  it.each([
    ['<img src=x onerror="alert(1)">', /onerror/i],
    ['<script>alert(1)</script>', /<script|alert/i],
    ['<iframe src="https://evil.com"></iframe>', /iframe/i],
    ['<object data="x"></object><embed src="x">', /object|embed/i],
    ['<form action="x"><input name="a"><button>b</button></form>', /form|button|<input/i],
    ['<a href="javascript:alert(1)">x</a>', /javascript/i],
    ['<a href="JaVaScRiPt:alert(1)">x</a>', /javascript/i],
    ['<a href="&#106;avascript:alert(1)">x</a>', /href/i],
    ['<a href="java\tscript:alert(1)">x</a>', /script:/i],
    ['<a href="vbscript:x">x</a>', /vbscript/i],
    ['<a href="data:text/html,<script>alert(1)</script>">x</a>', /data:|script/i],
    ['<a href="file:///C:/a">x</a>', /file:/i],
    ['<a href="snote://local/C:/a">x</a>', /snote:/i],
    ['<svg onload="alert(1)"><circle r="1"/></svg>', /svg|onload/i],
    ['<math><mi>x</mi></math>', /<math/i],
    ['<style>body{display:none}</style>', /<style|display/i],
    ['<p style="position:absolute;top:0">x</p>', /style/i],
    ['<div class="code-run wikilink remote-image">x</div>', /class/i],
    ['<span data-wikilink="노트" data-remote-url="https://a">x</span>', /data-/i],
    ['<div id="root">x</div>', /id=/i],
    ['<a href="https://a.com" target="_blank" name="x">x</a>', /target|name=/i],
    ['<!-- 주석 -->', /주석/],
    ['<link rel="stylesheet" href="x"><meta http-equiv="refresh" content="0">', /link|meta/i],
    ['<base href="https://evil.com/">', /base/i],
    ['<img src="data:image/svg+xml,<svg onload=alert(1)>">', /data:|onload/i]
  ])('%s 정리', (input, bad) => {
    expect(render(input)).not.toMatch(bad)
  })

  it('수식 자리표시 위조는 수식으로 바뀌지 않음', () => {
    const html = render('<span data-gh-math="abc-0"></span> $x^2$')
    expect(html).toContain('katex')
    expect(html).toContain('data-gh-math="abc-0"')
  })

  it('수식의 svg는 남기고 직접 쓴 svg는 지움', () => {
    expect(render('$\\sqrt{x}$')).toContain('katex')
    expect(render('<svg><path d="M0"/></svg>')).not.toContain('<svg')
  })

  it('이미지 주소는 바로 쓰지 않고 표시용 속성으로 옮김', () => {
    const html = render(
      '![a](https://x.com/a.png) ![b](img/b.png) <img src="docs/c.png" width="100">'
    )
    expect(html).not.toMatch(/\ssrc=/)
    expect(html).toContain('data-gh-remote="https://x.com/a.png"')
    expect(html).toContain('data-gh-rel="img/b.png"')
    expect(html).toContain('data-gh-rel="docs/c.png"')
    expect(html).toContain('width="100"')
  })
})

describe('GitHub 문법', () => {
  it('알림 5종', () => {
    for (const kind of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
      const html = render(`> [!${kind}]\n> 내용`)
      expect(html).toContain(`markdown-alert markdown-alert-${kind.toLowerCase()}`)
      expect(html).toContain('markdown-alert-title')
      expect(html).toContain('내용')
      expect(html).not.toContain('[!')
    }
  })

  it('알림이 아닌 인용문은 그대로', () => {
    expect(render('> 그냥 인용')).toContain('<blockquote>')
  })

  it('체크리스트와 각주', () => {
    const html = render('- [x] 완료\n- [ ] 할 일\n\n본문[^1]\n\n[^1]: 각주')
    expect(html).toContain('task-list-item-checkbox')
    expect(html).toContain('footnote-ref')
    expect(html).toContain('id="fn1"')
  })

  it('Mdesk 전용 문법은 글자 그대로', () => {
    const html = render('[[노트]] ![[img/a.png]]')
    expect(html).toContain('[[노트]]')
    expect(html).not.toContain('wikilink')
  })
})
