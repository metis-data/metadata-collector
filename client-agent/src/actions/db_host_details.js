const Errors = require('../config/error');
const { METIS_ENVIRONMENT, METIS_PROVIDER_METADATA } = require('../consts');
const { createSubLogger } = require('../logging');
const { MetisEnvironment, CloudProvider } = require('../models');
const AwsProvider = require('../providers/aws-provider');

const logger = createSubLogger('dbHostDetails');

async function sendResults({ payload, options }) {
    return;
}

async function run() {
    try {
        logger.info('run - start');
        if (METIS_ENVIRONMENT === MetisEnvironment.CLOUD) {
            let provider;
            const data = METIS_PROVIDER_METADATA?.map((providerData) => {
                const { instance_id, provider: cloudProvider } = providerData;
                switch (cloudProvider) {
                    case CloudProvider.AWS:
                        provider = new AwsProvider();
                        break;
                    default:
                        logger.error(Errors.NOT_SUPPORTED_METIS_CLOUD_PROVIDER);
                        throw Errors.NOT_SUPPORTED_METIS_CLOUD_PROVIDER;
                }

                return provider.getDbHostMetadata(instance_id);
            });

            const promises = await Promise.allSettled(data);
            const results = promises.map(prom => prom.status === 'fulfilled' ? prom.value : {});
            logger.info('run - end');
            return results;
        }
        else if (METIS_ENVIRONMENT === MetisEnvironment.PREM) {
            throw Errors.NOT_SUPPORTED_METIS_ENVIRONMENT;
        }
    }
    catch (e) {
        logger.error(e);
        throw e;
    }
}

module.exports = {
    dbHostDetails: {
        fn: run,
        exporter: {
            sendResults: sendResults
        },
    },
};