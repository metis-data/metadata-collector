const { WEB_APP_REQUEST_OPTIONS, COLLECTOR_REQUEST_OPTIONS } = require("../consts")

const ExportersProvider = {
    APP: 'app',
    COLLECTOR: 'collector'
}

const ExportersProviderConfig = {
    [ExportersProvider.APP]: {
        httpOptions: WEB_APP_REQUEST_OPTIONS
    },
    [ExportersProvider.COLLECTOR]: {
        httpOptions: COLLECTOR_REQUEST_OPTIONS
    },
}

module.exports = {
    ExportersProvider,
    ExportersProviderConfig
}