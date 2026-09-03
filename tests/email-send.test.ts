import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendEmail } from '../lib/email/send'

const msg = { to: 'a@b.com', subject: 'hi', html: '<p>hi</p>', text: 'hi' }

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('sendEmail', () => {
  it('is a no-op without RESEND_API_KEY and never touches the network', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('EMAIL_FROM', 'kpick3 <picks@kpick3.com>')
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('network call in no-op mode') }))
    const result = await sendEmail(msg)
    expect(result.sent).toBe(false)
  })

  it('POSTs to Resend and reports success', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key')
    vi.stubEnv('EMAIL_FROM', 'kpick3 <picks@kpick3.com>')
    const fetchMock = vi.fn(async () => new Response('{"id":"1"}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendEmail(msg)
    expect(result).toEqual({ sent: true })
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toBe('https://api.resend.com/emails')
    const body = JSON.parse(call[1].body as string)
    expect(body.to).toEqual(['a@b.com'])
    expect(body.from).toBe('kpick3 <picks@kpick3.com>')
  })

  it('reports failure with the status on a non-2xx response', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key')
    vi.stubEnv('EMAIL_FROM', 'kpick3 <picks@kpick3.com>')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 422 })))
    const result = await sendEmail(msg)
    expect(result.sent).toBe(false)
    if (!result.sent) expect(result.reason).toContain('422')
  })
})
