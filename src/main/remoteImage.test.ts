import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'http'
import type { AddressInfo } from 'net'
import {
  MAX_IMAGE_BYTES,
  fetchRemoteImage,
  imageFileName,
  isBlockedAddress,
  parseImageUrl,
  sniffImageType
} from './remoteImage'

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32)
])

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:192.168.1.1',
    '::ffff:c0a8:101',
    '64:ff9b::7f00:1',
    'localhost',
    'not-an-ip'
  ])('%s 차단', (ip) => expect(isBlockedAddress(ip)).toBe(true))

  it.each(['8.8.8.8', '140.82.112.3', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8'])(
    '%s 허용',
    (ip) => expect(isBlockedAddress(ip)).toBe(false)
  )
})

describe('parseImageUrl', () => {
  it.each([
    'javascript:alert(1)',
    'file:///C:/Windows/win.ini',
    'data:image/png;base64,AAAA',
    'ftp://example.com/a.png',
    'snote://local/C:/a.png',
    'http://user:pw@example.com/a.png',
    'http://example.com:8080/a.png',
    'https://example.com:22/a.png',
    '아무 글자'
  ])('%s 거부', (raw) => expect(parseImageUrl(raw)).toBeNull())

  it.each(['https://example.com/a.png', 'http://example.com:80/a.png', ' https://example.com/a '])(
    '%s 허용',
    (raw) => expect(parseImageUrl(raw)).not.toBeNull()
  )
})

describe('sniffImageType', () => {
  it('형식 판정', () => {
    expect(sniffImageType(PNG)).toBe('image/png')
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(Buffer.from('GIF89a....'))).toBe('image/gif')
    expect(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(
      sniffImageType(Buffer.from('<?xml version="1.0"?>\n<!-- x -->\n<svg xmlns="x"></svg>'))
    ).toBe('image/svg+xml')
  })

  it('이미지가 아니면 null', () => {
    expect(sniffImageType(Buffer.from('<!doctype html><html><svg></svg></html>'))).toBeNull()
    expect(sniffImageType(Buffer.from('<html><body>hi</body></html>'))).toBeNull()
    expect(sniffImageType(Buffer.from('{"a":1}'))).toBeNull()
    expect(sniffImageType(Buffer.alloc(0))).toBeNull()
  })
})

describe('imageFileName', () => {
  it('실제 형식 확장자로 바꿈', () => {
    expect(imageFileName(new URL('https://x.com/a/logo.jpg?v=1'), 'image/png')).toBe('logo.png')
    expect(imageFileName(new URL('https://x.com/%ED%95%9C%EA%B8%80.png'), 'image/png')).toBe(
      '한글.png'
    )
    expect(imageFileName(new URL('https://x.com/'), 'image/svg+xml')).toBe('이미지.svg')
    expect(imageFileName(new URL('https://x.com/a%2F..%2F..%2Fb.png'), 'image/png')).toBe(
      'a....b.png'
    )
  })
})

describe('fetchRemoteImage', () => {
  let server: http.Server
  let base = ''
  const open = { isBlocked: () => false, allowAnyPort: true }

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const path = req.url ?? '/'
      if (path === '/img.png') return res.end(PNG)
      if (path === '/html') return res.end('<html></html>')
      if (path === '/redirect') {
        res.writeHead(302, { Location: '/img.png' })
        return res.end()
      }
      if (path === '/loop') {
        res.writeHead(302, { Location: '/loop' })
        return res.end()
      }
      if (path === '/to-js') {
        res.writeHead(302, { Location: 'javascript:alert(1)' })
        return res.end()
      }
      if (path === '/big') {
        res.write(PNG)
        res.end(Buffer.alloc(MAX_IMAGE_BYTES))
        return
      }
      if (path === '/gzip') {
        res.writeHead(200, { 'Content-Encoding': 'gzip' })
        return res.end(PNG)
      }
      if (path === '/cookie') {
        return res.end(req.headers.cookie || req.headers.referer ? 'leak' : PNG)
      }
      res.writeHead(404)
      return res.end()
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => server.close())

  it('localhost는 기본 설정에서 차단', async () => {
    const r = await fetchRemoteImage(`${base}/img.png`, { allowAnyPort: true })
    expect(r).toEqual({ ok: false, error: 'blocked' })
  })

  it('이름이 localhost로 풀리는 주소도 차단', async () => {
    const port = (server.address() as AddressInfo).port
    const r = await fetchRemoteImage(`http://localhost:${port}/img.png`, { allowAnyPort: true })
    expect(r).toEqual({ ok: false, error: 'blocked' })
  })

  it('이미지 받기', async () => {
    const r = await fetchRemoteImage(`${base}/img.png`, open)
    expect(r.ok && r.mime).toBe('image/png')
    expect(r.ok && r.name).toBe('img.png')
  })

  it('리디렉션 따라감', async () => {
    const r = await fetchRemoteImage(`${base}/redirect`, open)
    expect(r.ok).toBe(true)
  })

  it('리디렉션 횟수 제한', async () => {
    expect(await fetchRemoteImage(`${base}/loop`, open)).toEqual({ ok: false, error: 'failed' })
  })

  it('리디렉션 대상도 다시 검사', async () => {
    expect(await fetchRemoteImage(`${base}/to-js`, open)).toEqual({ ok: false, error: 'blocked' })
  })

  it('리디렉션 대상 IP 차단', async () => {
    let calls = 0
    const r = await fetchRemoteImage(`${base}/redirect`, {
      allowAnyPort: true,
      isBlocked: () => calls++ > 0
    })
    expect(r).toEqual({ ok: false, error: 'blocked' })
  })

  it('이미지가 아니면 거부', async () => {
    expect(await fetchRemoteImage(`${base}/html`, open)).toEqual({ ok: false, error: 'not-image' })
  })

  it('10MB 넘으면 거부', async () => {
    expect(await fetchRemoteImage(`${base}/big`, open)).toEqual({ ok: false, error: 'too-large' })
  })

  it('압축 응답 거부', async () => {
    expect(await fetchRemoteImage(`${base}/gzip`, open)).toEqual({ ok: false, error: 'failed' })
  })

  it('쿠키·Referer 보내지 않음', async () => {
    const r = await fetchRemoteImage(`${base}/cookie`, open)
    expect(r.ok).toBe(true)
  })

  it('404는 실패', async () => {
    expect(await fetchRemoteImage(`${base}/none`, open)).toEqual({ ok: false, error: 'failed' })
  })
})
