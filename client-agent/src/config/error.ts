enum Errors {
    REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
    COULDNT_LOAD_CONFIG_FILE =  'COULDNT_LOAD_CONFIG_FILE',
    COULDNT_COLLECT_METRICS = 'COULDNT_COLLECT_METRICS',
    NOT_SUPPORTED_METIS_ENVIRONMENT = 'NOT_SUPPORTED_METIS_ENVIRONMENT',
    NOT_SUPPORTED_METIS_CLOUD_PROVIDER = 'NOT_SUPPORTED_METIS_CLOUD_PROVIDER',
    NOT_SUPPORTED_METIS_RESOURCE =  'NOT_SUPPORTED_METIS_RESOURCE',
};

class MetricError extends Error {

    constructor(message: any) {
        super(message)
    }
}

class SilentError extends MetricError {
    constructor(message: any) {
        super(message)
    }
}

export  {
    Errors,
    MetricError,
    SilentError,
};