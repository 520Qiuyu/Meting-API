import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import api from './api.js'
import { request } from '../providers/netease/util.js'

vi.mock('../providers/netease/util.js', async () => ({ ...await vi.importActual('../providers/netease/util.js'), request: vi.fn() }))
vi.mock('../admin/store.js', () => ({ default: {}, selectRequestCookie: cookie => cookie }))

const app = new Hono().get('/api', api)
const queryApi = query => app.request(`/api?server=netease&id=test&${query}`, { headers: { 'X-OpenMusic-Cookie': 'test-cookie' } })

describe('API 分页参数', () => {
    beforeEach(() => {
        vi.mocked(request).mockReset().mockImplementation(async (method, url, data) => ({
            code: 200,
            result: { songs: Array.from({ length: data.limit }, (_, index) => ({
                id: data.offset + index + 1, name: `歌曲 ${data.offset + index + 1}`, ar: [{ name: '测试歌手' }],
            })) },
            more: false,
            programs: [{ id: data.offset + 1, name: `节目 ${data.offset + 1}`, mainSong: { id: 1001 } }],
        }))
    })

    it('converts a one-based search page to an upstream offset', async () => {
        const response = await queryApi('type=search&limit=60&page=2')
        expect(response.status).toBe(200)
        const songs = await response.json()
        expect(songs).toHaveLength(60)
        expect(songs[0].title).toBe('歌曲 61')
        expect(songs[0].url).toContain('type=url&id=61')
    })

    it('gives an explicit offset priority over the page number', async () => {
        const response = await queryApi('type=search&limit=20&page=2&offset=100')
        expect((await response.json())[0].title).toBe('歌曲 101')
    })

    it('keeps the default search page size for existing clients', async () => {
        const response = await queryApi('type=search')
        expect(await response.json()).toHaveLength(30)
    })

    it('accepts the second radio page', async () => {
        const response = await queryApi('type=dj&page=2')
        expect((await response.json())[0].id).toBe('101')
    })

    it.each([
        'limit=0', 'limit=-1', 'limit=101', 'limit=1.5', 'limit=', 'limit=no',
        'page=0', 'page=-1', 'page=1.5', 'page=', 'page=9007199254740992',
        'offset=-1', 'offset=1.5', 'offset=', 'offset=Infinity', 'offset=9007199254740991',
        'page=9007199254740991&limit=100',
    ])('rejects invalid pagination: %s', async query => {
        const response = await queryApi(`type=search&${query}`)
        expect(response.status).toBe(400)
    })
})
