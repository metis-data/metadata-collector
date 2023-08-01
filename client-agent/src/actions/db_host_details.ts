import { Errors, SilentError } from '../config/error';
import { METIS_ENVIRONMENT, METIS_PROVIDER_METADATA } from '../consts';
import { makeInternalHttpRequest } from '../http';
import { createSubLogger } from '../logging';
import { MetisEnvironment, CloudProvider } from '../models';
import {AwsProvider}from '../providers/aws-provider';

const logger = createSubLogger('dbHostDetails');

async function sendResults({ payload, options }: any) {
  logger.debug('sendResults - calling makeInternalHttpRequest: ', payload, options);
  return makeInternalHttpRequest(payload, options);
}

async function run() {
  logger.debug('run - start');
  if (METIS_ENVIRONMENT !== MetisEnvironment.CLOUD) {
    // support only CLOUD env, we will support in the future: MetisEnvironment.PREM
    throw new SilentError(Errors.NOT_SUPPORTED_METIS_ENVIRONMENT);
  }

  let provider;
  const data = METIS_PROVIDER_METADATA?.map((providerData: any) => {
    const { instance_id, provider: cloudProvider } = providerData;
    switch (cloudProvider) {
      case CloudProvider.AWS:
        provider = new AwsProvider();
        break;
      default:
        throw new Error(Errors.NOT_SUPPORTED_METIS_CLOUD_PROVIDER);
    }

    return provider.getDbHostMetadata(instance_id);
  });

  const promises = await Promise.allSettled(data);
  const results = promises.map((prom) => (prom.status === 'fulfilled' ? prom.value : {}));
  logger.debug('run - end');
  return results;
}

export default  {
  dbHostDetails: {
    fn: run,
    exporter: {
      sendResults: sendResults,
    },
  },
};
