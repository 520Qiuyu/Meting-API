import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const html = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'security', 'security_host.html'),
    'utf8',
)

it('resolves the verification bridge from the document URL, not the page origin', () => {
    // sandbox 缺少 allow-same-origin 时 location.origin === "null"，
    // `${location.origin}${bridgeRoot}` 会退化成一个相对地址并 404。
    expect(html).not.toMatch(/\$\{location\.origin\}/)
    expect(html).toContain('const documentUrl = new URL(location.href)')
    expect(html).toContain('const bridgeBase = new URL(bridgeRoot, documentUrl).href')
    expect(html).toContain("bridgeUrl('request')")
    expect(html).toContain("bridgeUrl('start')")
    expect(html).toContain("bridgeUrl('complete')")
})

it('reports the finished verification to the real document origin', () => {
    expect(html).toContain("'qishui-second-verify-complete', key: verifyKey }, documentUrl.origin")
})
