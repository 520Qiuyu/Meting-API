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

it('widens sandbox on frames created inside the verification page', () => {
    // 官方组件会在本页内再嵌一个 iframe（抖音验证中心）。它若在子 iframe 上写了
    // 缺少 allow-same-origin 的 sandbox，子页面 document.cookie 会抛 SecurityError。
    expect(html).toContain('REQUIRED_SANDBOX_TOKENS')
    expect(html).toContain("'allow-same-origin'")
    // 三条创建路径都必须覆盖：setAttribute、sandbox 属性赋值、HTML 解析器。
    expect(html).toContain('Element.prototype.setAttribute = function (name, value)')
    expect(html).toContain('Object.defineProperty(HTMLIFrameElement.prototype, \'sandbox\'')
    expect(html).toContain('const relaxSandboxHtml = html =>')
    expect(html).toContain('Object.defineProperty(proto, property, {')
    expect(html).toContain('Element.prototype.insertAdjacentHTML = function (position, value)')
    expect(html).toContain('Document.prototype.write = function (...parts)')
    // 导航已经开始后才写 sandbox 的情况，必须重新导航一次才能生效。
    expect(html).toContain('const renegotiateFrame = frame =>')
    expect(html).toContain('new MutationObserver')
    expect(html).toContain("attributeFilter: ['sandbox']")
    expect(html).toContain("node.querySelectorAll('iframe').forEach(relaxFrame)")
})
