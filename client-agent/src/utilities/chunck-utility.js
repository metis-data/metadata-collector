function* chuncker(data, limit = 200000) {
    if (!data || (Array.isArray(data) && data.length === 0)) {
        return [];
    }

    let result = [];
    let counter = 0;
    for (const item of data) {
        counter += item.length;
        result.push(item);
        if (counter >= limit) {
            yield result;
            counter = 0;
            result = []; // start a new chunk
        }
    }

    yield result;
}

module.exports = chuncker;