import { beforeEach, describe, expect, it, vi } from 'vitest'
import Providers from '../index.js'
import { request } from './util.js'

vi.mock('./util.js', async () => ({ ...await vi.importActual('./util.js'), request: vi.fn() }))

const song = id => ({ id, name: `歌曲 ${id}`, ar: [{ name: '测试歌手' }] })
const program = id => ({ id, name: `节目 ${id}`, mainSong: song(id + 1000) })
const provider = new Providers().get('netease')

beforeEach(() => { vi.mocked(request).mockReset() })

describe('网易云歌曲搜索分页', () => {
    it('returns songs after the first 30 results through the provider dispatcher', async () => {
        vi.mocked(request).mockImplementation(async (method, url, data) => ({
            code: 200,
            result: { songs: Array.from({ length: data.limit }, (_, index) => song(data.offset + index + 1)) },
        }))
        const songs = await provider.handle('search', '测试歌手', 'test-cookie', { limit: 60, offset: 60 })
        expect(songs).toHaveLength(60)
        expect(songs[0]).toMatchObject({ title: '歌曲 61', author: '测试歌手', url: 61 })
        expect(songs[59].url).toBe(120)
    })

    it('returns an empty list at the end of search results', async () => {
        vi.mocked(request).mockResolvedValue({ code: 200, result: { songCount: 0 } })
        expect(await provider.handle('search', '测试歌手', '', { offset: 300 })).toEqual([])
    })

    it('does not treat an upstream search error as the last page', async () => {
        vi.mocked(request).mockResolvedValue({ code: 503, message: 'search unavailable' })
        await expect(provider.handle('search', '测试歌手')).rejects.toThrow('search unavailable')
    })
})

describe('网易云电台节目加载', () => {
    it('loads all 235 programs by default instead of stopping at 100', async () => {
        vi.mocked(request).mockImplementation(async (method, url, data) => ({
            code: 200, count: 235, more: data.offset + data.limit < 235,
            programs: Array.from({ length: Math.min(data.limit, 235 - data.offset) }, (_, index) => program(data.offset + index + 1)),
        }))
        const programs = await provider.handle('dj', 'radio-id', 'test-cookie')
        expect(programs).toHaveLength(235)
        expect(programs[100]).toMatchObject({ id: '101', title: '节目 101', url: 1101 })
        expect(programs[234].id).toBe('235')
    })

    it('returns only the requested page when pagination is explicit', async () => {
        vi.mocked(request).mockImplementation(async (method, url, data) => ({
            code: 200, more: true,
            programs: Array.from({ length: data.limit }, (_, index) => program(data.offset + index + 1)),
        }))
        const programs = await provider.handle('dj', 'radio-id', '', { limit: 20, offset: 100 })
        expect(programs).toHaveLength(20)
        expect(programs[0].id).toBe('101')
        expect(programs[19].id).toBe('120')
    })

    it.each([{ more: true }, { count: 3 }])('continues short pages when more programs are available: %j', async metadata => {
        vi.mocked(request).mockResolvedValueOnce({ code: 200, ...metadata, programs: [program(1), program(2)] })
            .mockResolvedValueOnce({ code: 200, more: false, programs: [program(3)] })
        expect((await provider.handle('dj', 'radio-id')).map(item => item.id)).toEqual(['1', '2', '3'])
    })

    it('deduplicates overlapping pages and stops if the upstream repeats a page', async () => {
        vi.mocked(request).mockResolvedValueOnce({ code: 200, more: true, programs: [program(1), program(2)] })
            .mockResolvedValue({ code: 200, more: true, programs: [program(2), program(3)] })
        expect((await provider.handle('dj', 'radio-id')).map(item => item.id)).toEqual(['1', '2', '3'])
    })

    it('stops on an empty page even if more is true', async () => {
        vi.mocked(request).mockResolvedValue({ code: 200, more: true, programs: [] })
        expect(await provider.handle('dj', 'radio-id')).toEqual([])
    })

    it('rejects a later upstream failure instead of returning a truncated list', async () => {
        vi.mocked(request).mockResolvedValueOnce({ code: 200, more: true, programs: [program(1)] })
            .mockResolvedValueOnce({ code: 503, message: 'radio unavailable' })
        await expect(provider.handle('dj', 'radio-id')).rejects.toThrow('radio unavailable')
    })
})
