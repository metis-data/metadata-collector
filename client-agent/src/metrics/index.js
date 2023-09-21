const { Errors, SilentError } = require('../config/error');
const {
  COLLECTOR_REQUEST_OPTIONS,
  METIS_ENVIRONMENT: metis_environment,
  METIS_PROVIDER_METADATA: provider_metadata = {},
} = require('../consts');
const { makeInternalHttpRequest } = require('../http');
const { createSubLogger } = require('../logging');
const { MetisEnvironment, CloudProvider, CloudResource } = require('../models');
const AwsRdsResource = require('./aws/rds');
const METRIC_PROVIDER_MAPPER = require('./models');


const logger = createSubLogger('MetricController');

class MetricController {
  async #sendData(data) {
    logger.debug('sendData - calling makeInternalHttpRequest', {
      COLLECTOR_REQUEST_OPTIONS,
    });
    const res = await makeInternalHttpRequest(data, COLLECTOR_REQUEST_OPTIONS);
    return res;
  }

  async #collectMetrics(connections) {
    logger.info('collectMetrics - start');
    const results = {};

    try {
      if (metis_environment === MetisEnvironment.CLOUD) {
        let metrics;
        const promises = provider_metadata.map(async (providerData) => {
          return new Promise(async (res, rej) => {
            let provider;
            const { resource, instance_id, provider: cloudProvider } = providerData;

            if (cloudProvider === CloudProvider.AWS) {
              metrics = Object.keys(METRIC_PROVIDER_MAPPER).map((metric) => ({
                ...METRIC_PROVIDER_MAPPER?.[metric]?.[CloudProvider.AWS],
                measurement: metric,
              }));

              switch (resource) {
                case CloudResource.RDS:
                  provider = new AwsRdsResource(instance_id, metrics);
                  break;
                default:
                  throw new Error(Errors.NOT_SUPPORTED_METIS_RESOURCE);
              }
            } else {
              throw new Error(Errors.NOT_SUPPORTED_METIS_CLOUD_PROVIDER);
            }

            if (provider) {
              logger.debug('collectMetrics - calling provider.collect');
              const data = await provider.collect(connections);
              logger.debug('collectMetrics - calling provider.normalize');
              const normalizedData = provider.normalize(data);
              return res(normalizedData);
            } else {
              return rej(new Error(Errors.COULDNT_COLLECT_METRICS));
            }
          });
        });
        const res = await Promise.allSettled(promises);
        results.results = res
          .map((prom) => (prom.status === 'fulfilled' ? prom.value : []))
          ?.flat(Infinity);
        results.success = true;
      } else {
        throw new SilentError(Errors.NOT_SUPPORTED_METIS_ENVIRONMENT);
      }
    } catch (e) {
      results.success = false;
      results.error = e;
    } finally {
      logger.info('collectMetrics - end');
      return results;
    }
  }

  async runner(_, connections) {
    const results = await this.#collectMetrics(connections);
    if (results.success) {
      const { results: data } = results;
      if (Array.isArray(data) && data.length === 0) {
        logger.warn('runner - sucessfuly end with no results!', connections);
      } else {
        const response = await this.#sendData(data);
        return response;
      }
    } else {
      throw results?.error || new Error('Couldnt collect metrics from provider');
    }
  }
}

const metricController = new MetricController();

module.exports = {
  collectMetrics: metricController.runner.bind(metricController),
};
