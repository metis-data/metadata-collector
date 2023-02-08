function isError(statusCode) {
    return statusCode > 299 && statusCode < 200;
}

module.exports = {
    isError
}