import crypto from 'crypto'
import { Buffer } from 'buffer/index.js'


const seenNonces = new Map()
const WINDOW_MS = 60_000
const MAX_NONCES = 100_000

const sameSignature = (expected, actual) => {
    if (typeof actual !== 'string' || actual.length !== expected.length) return false
    let difference = 0
    for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index)
    return difference === 0
}

export const verifyMetingAssertion = ({ secret, url, headers, method = 'GET', body = '', now = Date.now(), seen = seenNonces }) => {
    const readHeader = (name) => typeof headers?.get === 'function' ? headers.get(name) : headers?.[name]
    const encoded = readHeader('X-OpenMusic-Assertion')
    const signature = readHeader('X-OpenMusic-Signature')
    const reject = (code = 'OPENMUSIC_AUTH_REQUIRED') => ({ ok: false, code })
    if (!secret || typeof encoded !== 'string' || encoded.length > 768 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return reject()
    try {
        const claims = JSON.parse(Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
        if (claims.v !== 1 || !Number.isSafeInteger(claims.ts) || Math.abs(now - claims.ts * 1000) > WINDOW_MS || !/^[A-Za-z0-9_-]{24}$/.test(claims.nonce)) return reject()
        if (!(claims.purpose === 'account' && /^acct_[A-Za-z0-9_-]{16,64}$/.test(claims.sub)) && !(claims.purpose === 'system' && claims.sub === 'openmusic:system')) return reject()
        const target = new URL(url)
        const payload = [encoded, method.toUpperCase(), target.pathname + target.search, crypto.createHash('sha256').update(body || '').digest('hex')].join('\n')
        const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        if (!sameSignature(expected, signature)) return reject()
        for (const [nonce, expiresAt] of seen) {
            if (expiresAt > now) break
            seen.delete(nonce)
        }
        const key = crypto.createHash('sha256').update(`${secret}:${claims.nonce}`).digest('hex')
        if (seen.has(key)) return reject('OPENMUSIC_REPLAY')
        if (seen.size >= MAX_NONCES) return reject('OPENMUSIC_AUTH_BUSY')
        seen.set(key, now + WINDOW_MS * 2)
        return { ok: true, accountId: claims.purpose === 'account' ? claims.sub : '', purpose: claims.purpose }
    } catch {
        return reject()
    }
}
