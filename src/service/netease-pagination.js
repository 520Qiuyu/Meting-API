export const parseNeteasePagination = (query, server, type) => {
    if (server !== 'netease' || !['search', 'dj'].includes(type)
        || !['limit', 'offset', 'page'].some(key => query[key] !== undefined)) return {}

    const limit = Number(query.limit ?? (type === 'dj' ? 100 : 30))
    const page = Number(query.page ?? 1)
    const offset = Number(query.offset ?? ((page - 1) * limit))
    const validParams = ['limit', 'offset', 'page'].every(key => query[key] === undefined || /^\d+$/.test(query[key]))
    if (!validParams || !Number.isSafeInteger(limit) || limit < 1 || limit > 100
        || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(offset) || offset < 0
        || !Number.isSafeInteger(offset + limit)) return null

    return { limit, offset }
}
