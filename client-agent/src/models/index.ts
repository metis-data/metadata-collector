import { WEB_APP_REQUEST_OPTIONS, COLLECTOR_REQUEST_OPTIONS } from "../consts"

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

const CloudProvider = {
    AWS: 'aws',
    AZURE: 'azure',
    GCP: 'gcp'
}

const CloudResource = {
    RDS: 'rds',
}

const MetisEnvironment = {
    CLOUD: 'cloud',
    PREM: 'prem'
}

export {
    CloudResource,
    MetisEnvironment,
    ExportersProvider,
    ExportersProviderConfig,
    CloudProvider,
}