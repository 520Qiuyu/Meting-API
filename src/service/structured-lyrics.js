import { request } from '../providers/netease/util.js'
import { qrcDecrypt } from '../vendor/folia/qrcDecrypt.js'

const MAX_BYTES = 1024 * 1024
async function jsonRequest(url, init = {}) {
    const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error(`lyric upstream ${response.status}`)
    const reader = response.body.getReader()
    const chunks = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.length
            if (size > MAX_BYTES) throw new Error('lyric response too large')
            chunks.push(value)
        }
    } finally {
        await reader.cancel().catch(() => {})
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const text = value => typeof value === 'string' && value.length <= MAX_BYTES ? value : ''

export function normalizeStructuredLyrics(data = {}) {
    if (typeof data === 'string') data = { lyric: data }
    if (!data || typeof data !== 'object') data = {}
    const wordFormat = ['yrc', 'qrc', 'krc', 'ttml', 'enhanced-lrc'].find(key => text(data[key])) || ''
    return {
        version: 1,
        lyric: text(data.lyric),
        translation: text(data.tlyric),
        romanization: text(data.romalrc),
        wordLyric: wordFormat ? text(data[wordFormat]) : '',
        wordFormat,
        source: wordFormat ? 'platform' : 'lrc',
    }
}

async function neteaseWords(id, cookie) {
    const data = await request('POST', 'https://music.163.com/api/song/lyric/v1', {
        id, cp: false, lv: 0, tv: 0, rv: 0, kv: 0, yv: 0, ytv: 0, yrv: 0,
    }, { crypto: 'eapi', url: '/api/song/lyric/v1', cookie: cookie || {}, signal: AbortSignal.timeout(5000), maxResponseBytes: MAX_BYTES })
    return { lyric: data.lrc?.lyric, yrc: data.yrc?.lyric, tlyric: data.ytlrc?.lyric || data.tlyric?.lyric, romalrc: data.yromalrc?.lyric || data.romalrc?.lyric }
}

async function qqWords(mid, cookie) {
    const endpoint = 'https://u.y.qq.com/cgi-bin/musicu.fcg'
    const call = async (module, method, param) => {
        const result = await jsonRequest(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Referer': 'https://y.qq.com', 'User-Agent': 'okhttp/3.14.9', ...(cookie ? { Cookie: cookie } : {}) },
            body: JSON.stringify({ comm: { ct: 11, cv: '1003006', tmeAppID: 'qqmusiclight' }, request: { module, method, param } }),
        })
        if (result.code !== 0 || result.request?.code !== 0) throw new Error('QQ lyric unavailable')
        return result.request.data
    }
    const info = await call('music.pf_song_detail_svr', 'get_song_detail_yqq', { song_mid: mid })
    const song = info?.track_info
    if (!song?.id) return {}
    const b64 = value => Buffer.from(String(value || '')).toString('base64')
    const payload = await call('music.musichallSong.PlayLyricInfo', 'GetPlayLyricInfo', {
        songID: Number(song.id), songName: b64(song.name), albumName: b64(song.album?.name),
        singerName: b64(song.singer?.map(item => item.name).join(', ')), interval: song.interval || 0,
        crypt: 1, ct: 19, cv: 2111, lrc_t: 0, qrc: 1, qrc_t: 0, roma: 1, roma_t: 0, trans: 1, trans_t: 0, type: 0,
    })
    const decode = async value => typeof value === 'string' && /^[0-9a-f]+$/i.test(value) && value.length <= MAX_BYTES ? qrcDecrypt(value) : ''
    const qrc = await decode(payload.lyric)
    return { qrc: /\[\d+,\d+\]/.test(qrc) ? qrc : '', tlyric: await decode(payload.trans), romalrc: await decode(payload.roma) }
}

async function kugouWords(id) {
    const hash = String(id).split('_')[0]
    if (!/^[0-9a-f]{32}$/i.test(hash)) return {}
    const found = await jsonRequest(`https://lyrics.kugou.com/search?${new URLSearchParams({ ver: '1', man: 'yes', client: 'pc', hash })}`)
    const item = found.candidates?.[0]
    if (!item?.id || !item.accesskey) return {}
    const result = await jsonRequest(`https://lyrics.kugou.com/download?${new URLSearchParams({ ver: '1', client: 'pc', id: String(item.id), accesskey: item.accesskey, fmt: 'krc', charset: 'utf8' })}`)
    const bytes = Buffer.from(text(result.content), 'base64')
    if (bytes.subarray(0, 4).toString() !== 'krc1') return {}
    const key = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105]
    const compressed = bytes.subarray(4).map((value, index) => value ^ key[index % 16])
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'))
    const reader = stream.getReader()
    const chunks = []; let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.length
            if (size > MAX_BYTES) throw new Error('KRC too large')
            chunks.push(value)
        }
    } finally { await reader.cancel().catch(() => {}) }
    return { krc: Buffer.concat(chunks).toString('utf8') }
}

export async function getStructuredLyrics(server, id, cookie, original) {
    let data = typeof original === 'string' ? { lyric: original } : { ...original }
    if (!normalizeStructuredLyrics(data).wordLyric) {
        try {
            const extra = server === 'netease' ? await neteaseWords(id, cookie)
                : server === 'tencent' ? await qqWords(id, cookie)
                    : server === 'kugou' ? await kugouWords(id) : {}
            for (const [key, value] of Object.entries(extra)) if (text(value)) data[key] = value
        } catch {
            console.warn(`[Lyrics] ${server} word timing unavailable`)
        }
    }
    const result = normalizeStructuredLyrics(data)
    if (result.wordLyric || !['netease', 'tencent'].includes(server) || !/^[a-z0-9]{1,80}$/i.test(String(id))) return result
    try {
        const key = server === 'netease' ? 'ncmMusicId' : 'qqMusicId'
        const payload = await jsonRequest(`https://api.amll.dev/v1/lyrics/get?${new URLSearchParams({ [key]: String(id) })}`)
        if (payload.status === 200 && payload.data?.format === 'ttml' && text(payload.data.lyrics)) {
            result.wordLyric = payload.data.lyrics
            result.wordFormat = 'ttml'
            result.source = 'amll'
        }
    } catch { console.warn('[Lyrics] AMLL fallback unavailable') }
    return result
}
