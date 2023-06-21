const Errors = require('../config/error');
const { COLLECTOR_REQUEST_OPTIONS } = require('../consts');
const { makeInternalHttpRequest } = require('../http');
const { createSubLogger } = require('../logging');
const { MetisEnvironment, CloudProvider, CloudResource } = require('../models');
const AwsRdsResource = require('./aws/rds');
const METRIC_PROVIDER_MAPPER = require('./models');

const logger = createSubLogger('MetricController');

class MetricController {
    async #sendData(data) {
        try {
            logger.info('sendData - start');
            logger.debug('sendData - calling makeInternalHttpRequest', { data, COLLECTOR_REQUEST_OPTIONS });
            const res = await makeInternalHttpRequest(data, COLLECTOR_REQUEST_OPTIONS);
            logger.info('sendData - end');
            return res;
        }
        catch (e) {
            logger.error('sendData - error: ', e);
            throw e;
        }
    }

    async #collectMetrics(dbConfigs) {
        logger.info('collectMetrics - start');
        const results = {};

        try {
            const { metis_environment = '', metis_provider = '', metis_resource = '', provider_metadata = {} } = globalThis['metis_config'];

            let provider;

            if (metis_environment === MetisEnvironment.CLOUD) {
                let metrics;

                if (metis_provider === CloudProvider.AWS) {
                    metrics = Object.keys(METRIC_PROVIDER_MAPPER).map(metric => ({ ...METRIC_PROVIDER_MAPPER?.[metric]?.[CloudProvider.AWS], measurement: metric }));

                    switch (metis_resource) {
                        case CloudResource.RDS:
                            provider = new AwsRdsResource(provider_metadata, metrics);
                            break;
                        default:
                            throw Errors.NOT_SUPPORTED_METIS_RESOURCE;
                    }
                }
                else {
                    throw Errors.NOT_SUPPORTED_METIS_CLOUD_PROVIDER;
                }
            }
            else {
                throw Errors.NOT_SUPPORTED_METIS_ENVIRONMENT;
            }

            if (provider) {
                logger.debug('collectMetrics - calling provider.collect');
                const data = await provider.collect(dbConfigs);
                logger.debug('collectMetrics - calling provider.normalize');
                const normalizedData = provider.normalize(data);
                results.results = normalizedData;
            }
            else {
                throw Errors.COULDNT_COLLECT_METRICS;
            }
            results.success = true;
        }
        catch (e) {
            logger.error('collectMetrics - error: ', e);
            results.success = false;
            results.description = e;
        }
        finally {
            logger.debug('collectMetrics - results: ', results);
            logger.info('collectMetrics - end');
            return results;
        }
    }

    async runner(_, dbConfigs) {
        logger.info('runner - start');
        try {
            logger.debug('runner - calling collectMetrics');
            const results = await this.#collectMetrics(dbConfigs);
            logger.debug('runner - collectMetrics results: ', results);
            if (results.success) {
                const { results: data } = results;
                logger.debug('runner - calling sendData data: ', data);
                await this.#sendData(data);
                logger.error('runner - end');
                return;
            }
            else {
                throw results.description;
            }
        }
        catch (e) {
            logger.error('runner - error: ', e);
        }
    }
}

const metricController = new MetricController();


module.exports = metricController.runner.bind(metricController);