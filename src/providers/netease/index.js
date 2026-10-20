import { get_playlist } from "./playlist.js"
import { get_song_url, get_song_info } from "./song.js"
import { get_lyric } from "./lyric.js"
import { get_artist_songs } from "./artist_songs.js"
import { get_search_songs } from "./search.js"
import { get_search_playlists } from "./search_playlist.js"
import { get_personal_fm } from "./personal_fm.js"
import { get_dj_programs, get_dj_detail, get_dj_program_detail, get_dj_hot, get_search_djs } from "./dj.js"

const support_type = [
    'url', 'lrc', 'song', 'playlist', 'artist', 'search', 'search_playlist', 'pic', 'fm',
    'dj', 'dj_detail', 'djprogram', 'dj_hot', 'search_dj',
]

const handle = async (type, id, cookie = '', options = {}) => {
    let result;
    switch (type) {
        case 'lrc':
            result = await get_lyric(id, cookie)
            break
        case 'url':
            result = await get_song_url(id, cookie, options)
            break
        case 'pic':
            result = (await get_song_info(id, cookie))[0].pic
            break
        case 'song':
            result = await get_song_info(id, cookie)
            break
        case 'playlist':
            result = await get_playlist(id, cookie)
            break
        case 'artist':
            result = await get_artist_songs(id, cookie)
            break
        case 'search':
            result = await get_search_songs(id, cookie, options)
            break
        case 'search_playlist':
            result = await get_search_playlists(id, cookie)
            break
        case 'fm':
            result = await get_personal_fm(id, cookie)
            break
        case 'dj':
            result = await get_dj_programs(id, cookie, options)
            break
        case 'dj_detail':
            result = await get_dj_detail(id, cookie)
            break
        case 'djprogram':
            result = await get_dj_program_detail(id, cookie)
            break
        case 'dj_hot':
            result = await get_dj_hot(id, cookie)
            break
        case 'search_dj':
            result = await get_search_djs(id, cookie)
            break
        default:
            return -1;
    }
    return result
}

export default {
    register: (ctx) => {
        ctx.register('netease', { handle, support_type })
    }
}
